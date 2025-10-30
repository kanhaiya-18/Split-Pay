const Expense = require("../models/expense");
const Group = require("../models/Group");
const User = require("../models/user");
const mongoose = require("mongoose");
const extractTextFromImage = require("../utils/ocr");
const parseBillText = require("../utils/llmParser");

// Get all bills for a specific group (uses group from req.body like Settlements)
exports.getAllBills = async (req, res) => {
    try {
        const { group } = req.body;
        if (!group) {
            return res.status(400).json({ success: false, message: "Group ID missing" });
        }

        // Find expenses in the given group
        const expenses = await Expense.find({ group })
            .populate("group", "name members")
            .populate("createdBy", "name email")
            .populate("assignments.from", "name email")
            .populate("assignments.to", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            bills: expenses,
            count: expenses.length,
            message: "Bills fetched successfully"
        });
    } catch (err) {
        console.error("Error in getAllBills:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.uploadBill = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
        }

        // 🧠 Step 1: Extract text from image (OCR)
        const text = await extractTextFromImage(req.file.path);
        // console.log("🧾 Extracted Text:", text);

        // 🧩 Step 2: Parse structured data using Gemini
        const structuredData = await parseBillText(text);

        if (!structuredData || !structuredData.items) {
            return res.status(500).json({
                success: false,
                message: "Failed to parse bill text from Gemini",
            });
        }

        // 🧮 Step 3: Calculate total amount if Gemini didn't provide one
        const total =
            structuredData.total ||
            structuredData.items.reduce(
                (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
                0
            );

        // Derive a reliable bill name
        const fallbackFromFilename = (req.file.originalname || "")
            .replace(/\.[^/.]+$/, "") // drop extension
            .trim();
        const providedBillName = (req.body.billName || "").trim();
        const parsedBillName = (structuredData.billName || "").trim();
        const billName = parsedBillName || providedBillName || fallbackFromFilename || "Untitled Bill";

        // 🧱 Step 4: Create Expense in MongoDB with parsed details
        const expense = await Expense.create({
            billName,
            group: req.body.groupId,
            createdBy: req.user.id,
            billImageUrl: req.file.path,
            totalAmount: total,
            items: structuredData.items,
            splitMethod: "equal",
        });

        // ✅ Step 5: Send structured data to frontend
        res.status(200).json({
            success: true,
            expense,
            message: "Bill uploaded, parsed, and saved successfully",
        });
    } catch (err) {
        console.error("💥 Error in uploadBill:", err.message);
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};


// Parse OCR output into structured data
// exports.parseBill = async (req, res) => {
//     try {
//         const { expenseId, rawText } = req.body;
//         if (!expenseId || !rawText) {
//             return res.status(400).json({ success: false, message: "Missing expenseId or rawText" });
//         }

//         const structuredData = await parseBillText(rawText);

//         if (!structuredData) {
//             return res.status(500).json({ success: false, message: "Failed to parse bill text" });
//         }

//         // Calculate total amount
//         const total = structuredData.total || structuredData.items.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);

//         // Update the Expense with parsed data
//         const updatedExpense = await Expense.findByIdAndUpdate(
//             expenseId,
//             { items: structuredData.items, totalAmount: total },
//             { new: true }
//         );

//         res.status(200).json({
//             success: true,
//             expense: updatedExpense,
//             message: "Bill parsed and saved successfully"
//         });
//     } catch (err) {
//         res.status(500).json({ success: false, message: err.message });
//     }
// };
//sent the bils's details to frontend
exports.getBillDetails = async (req, res) => {
    try {
        const { expenseId } = req.params;
        if (!expenseId) {
            return res.status(400).json({ success: false, message: "Missing expenseId" });
        }
        const expense = await Expense.findById(expenseId)
            .populate("group", "groupName members")
            .populate("createdBy", "name email")
            .populate("assignments.from", "name email")
            .populate("assignments.to", "name email");
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }
        res.status(200).json({ success: true, expense, message: "Expense details fetched successfully" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

//assign the amount to the members of the group 
exports.assignMoney = async (req, res) => {
    try {
        const { expenseId, assignments } = req.body;
        if (!expenseId || !assignments) {
            return res.status(400).json({ success: false, message: "expenseId or assignment doesn't exist" });
        }
        // get the expense from expenseId
        const expense = await Expense.findById(expenseId).populate("group");
        if (!expense) {
            return res.status(404).json({ success: false, message: "expense not found" });
        }
        // validate users belong to the group
        const groupMembersIds = (await Group.findById(expense.group._id)).members.map(m => m.toString());
        let sumAssigned = 0;
        // Validate users belong to group
        for (let a of assignments) {
            if (!a.from || !a.to || typeof a.amount !== "number") {
                return res.status(400).json({ success: false, message: "Each assignment needs from, to, and numeric amount" });
            }
            if (!groupMembersIds.includes(a.from.toString()) || !groupMembersIds.includes(a.to.toString())) {
                return res.status(400).json({ success: false, message: `Invalid assignment: ${a.from} or ${a.to} not in group` });
            }
            sumAssigned += Number(a.amount || 0);
        }

        // allow small rounding tolerance (0.5)
        // const tolerance = 0.5;
        // if (Math.abs(sumAssigned - (expense.totalAmount || 0)) > tolerance) {
        //     return res.status(400).json({
        //         success: false,
        //         message: `Assigned sum (${sumAssigned}) does not match totalAmount (${expense.totalAmount}).`
        //     });
        // }

        //now save assignment
        expense.assignments = assignments.map(a => ({
            from: a.from, // who owes
            to: a.to,     // who should receive
            amount: a.amount
        }));

        expense.splitMethod = "money";
        await expense.save();
        return res.status(200).json({ success: true, expense, message: "assigned money successfully to the members" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
//assign monyey equally to the users provided by the frontend
exports.assignEqually = async (req, res) => {
    try {
        const { expenseId, userIds, paidBy, groupId } = req.body;
        if (!expenseId || !userIds || !paidBy || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: "expenseId or userIds are missing/invalid" });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }
        //check if the user belongs to the group
        for (const id of userIds) {
            if (group.members.map(m => m.toString()).indexOf(id) === -1) {
                return res.status(400).json({ success: false, message: `User ${id} is not a member of the group` });
            }
        }
        const expense = await Expense.findById(expenseId).populate("group");
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }
        const perUserAmount = parseFloat((expense.totalAmount / userIds.length).toFixed(2));
        const assignments = [];
        for (const userId of userIds) {
            if (userId === paidBy) continue; // Skip the payer
            assignments.push({
                from: userId,
                to: paidBy,
                amount: perUserAmount
            });
        }
        expense.assignments = assignments;
        expense.splitMethod = "equal";
        await expense.save();
        return res.status(200).json({ success: true, expense, message: "Expense assigned equally successfully" });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
exports.settleAssignments = async (req, res) => {
    try {
        const { expenseId } = req.body;
        const { id: requestedId } = req.user;

        if (!expenseId) return res.status(400).json({ success: false, message: "Missing expenseId" });

        const expense = await Expense.findById(expenseId)
            .populate("assignments.from")
            .populate("assignments.to")
            .populate("group");

        if (!expense) return res.status(404).json({ success: false, message: "Expense not found" });
        if (!expense.group.members.map(m => m.toString()).includes(requestedId)) {
            return res.status(403).json({ success: false, message: "You are not a member of this group" });
        }

        for (const a of expense.assignments) {
            if (!a || a.amount <= 0) continue;

            const fromId = a.from?._id?.toString() || a.from?.toString();
            const toId = a.to?._id?.toString() || a.to?.toString();

            // 🧩 Skip invalid or self-assigning transactions
            if (!fromId || !toId || fromId === toId) continue;

            // 🟢 Increase receiver’s “youAreOwed”
            await User.findByIdAndUpdate(toId, {
                $inc: { youAreOwed: a.amount }
            });

            // 🔴 Increase payer’s “youOwe”
            await User.findByIdAndUpdate(fromId, {
                $inc: { youOwe: a.amount }
            });
        }


        const updatedExpense = await Expense.findById(expenseId)
            .populate("assignments.from", "name email")
            .populate("assignments.to", "name email")
            .populate("group", "groupName");

        res.status(200).json({
            success: true,
            message: "Assignments settled successfully",
            expense: updatedExpense
        });
    } catch (err) {
        console.error("Error in settleAssignments:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// Record the payment
exports.recordPayment = async (req, res) => {
    try {
        const { expenseId, amount, method, paidBy } = req.body;
        const requestedId = req.user.id;
        const payerId = paidBy || requestedId;

        if (!expenseId || !amount) {
            return res.status(400).json({
                success: false,
                message: "Please provide expenseId and amount"
            });
        }

        //  Find the expense
        const expense = await Expense.findById(expenseId).populate("group");
        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        // Find the group
        const group = await Group.findById(expense.group);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        // Validate that both users are group members
        const groupMemberIds = group.members.map(m => m.toString());
        if (!groupMemberIds.includes(requestedId)) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this group"
            });
        }

        if (!groupMemberIds.includes(payerId)) {
            return res.status(400).json({
                success: false,
                message: "The specified payer is not a member of this group"
            });
        }
        //Actually record the payment now
        if (!expense.payments) expense.payments = [];
        expense.payments.push({
            user: payerId,
            amount,
            method: method || "cash"
        });

        // Save the expense
        await expense.save();

        //  Fetch populated version for clean response
        const updatedExpense = await Expense.findById(expenseId)
            .populate("payments.user", "name email")
            .populate("assignments.user", "name email")
            .populate("group", "groupName");
        //update the user db 
        // const UpdatedinUser = await User.findByIdAndUpdate(
        //     payerId,
        //     { $inc: { youAreOwed: amount } },
        //     { new: true }
        // );
        if (!UpdatedinUser) {
            return res.status(400).json({ success: false, message: "it has not been updated in userDB" });
        }
        // Return
        return res.status(200).json({
            success: true,
            message: `Payment of ₹${amount} recorded successfully (paid by user ${payerId})`,
            expense: updatedExpense
        });
    } catch (err) {
        console.error("Error in recordPayment:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


exports.splitExpense = async (req, res) => {
    try {
        const { expenseId } = req.params;

        // 1️⃣ Fetch expense with all populated fields
        const expense = await Expense.findById(expenseId)
            .populate("assignments.user", "name email")
            .populate("payments.user", "name email")
            .populate("group", "groupName");

        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

        const totalAmount = expense.totalAmount;
        const perUser = [];

        // 2️⃣ Build a map of assigned and paid
        const assignedMap = {};
        for (const a of expense.assignments || []) {
            const userId =
                typeof a.user === "object" ? a.user._id.toString() : a.user.toString();
            assignedMap[userId] = (assignedMap[userId] || 0) + a.amount;
        }

        const paidMap = {};
        for (const p of expense.payments || []) {
            const userId =
                typeof p.user === "object" ? p.user._id.toString() : p.user.toString();
            paidMap[userId] = (paidMap[userId] || 0) + p.amount;
        }

        // 3️⃣ Collect all users from both maps
        const userIds = new Set([...Object.keys(assignedMap), ...Object.keys(paidMap)]);

        // 4️⃣ Build per-user summary
        for (const userId of userIds) {
            const assigned = assignedMap[userId] || 0;
            const paid = paidMap[userId] || 0;
            const net = paid - assigned;

            const user =
                expense.assignments.find(a => a.user._id?.toString() === userId)?.user ||
                expense.payments.find(p => p.user._id?.toString() === userId)?.user;

            perUser.push({
                userId,
                name: user?.name || "Unknown",
                email: user?.email || "",
                assigned,
                paid,
                net
            });
        }

        // 5️⃣ Calculate settlements (who owes whom)
        const debtors = perUser.filter(u => u.net < 0);
        const creditors = perUser.filter(u => u.net > 0);
        const settlements = [];

        for (const debtor of debtors) {
            let amountToSettle = Math.abs(debtor.net);

            for (const creditor of creditors) {
                if (amountToSettle <= 0) break;

                const payAmount = Math.min(amountToSettle, creditor.net);
                if (payAmount > 0) {
                    settlements.push({
                        from: debtor.name,
                        to: creditor.name,
                        amount: payAmount
                    });

                    debtor.net += payAmount;
                    creditor.net -= payAmount;
                    amountToSettle -= payAmount;
                }
            }
        }

        // 6️⃣ Send response
        res.status(200).json({
            success: true,
            totalAmount,
            splitMethod: expense.splitMethod,
            perUser,
            settlements,
            message: "Split calculated successfully"
        });
    } catch (err) {
        console.error("💥 Split error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

//change the mark as paid to true when the payment is done
exports.markAssignmentPaid = async (req, res) => {
    try {
        const { expenseId, assignmentId, amountPaid } = req.body;
        if (!expenseId || !assignmentId || !amountPaid) {
            return res.status(400).json({ success: false, message: "expenseId or assignmentId missing" });
        }
        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }
        const assignment = expense.assignments.id(assignmentId);
        if (!assignment) {
            return res.status(404).json({ success: false, message: "Assignment not found" });
        }
        const currentUserId = req.user.id;
        if (currentUserId.toString() !== assignment.to.toString()) {
            return res.status(400).json({ success: false, message: "You are not authorized to mark this as paid" });
        }
        assignment.amount -= amountPaid;

        assignment.isPaid = assignment.amount <= 0 ? true : false;
        if (assignment.isPaid)
            assignment.paidAt = new Date();

        await expense.save();

        const ower = await User.findById(assignment.from);
        const receiver = await User.findById(assignment.to);

        if (ower && receiver) {
            ower.youOwe = Math.max(0, ower.youOwe - amountPaid);
            receiver.youAreOwed = Math.max(0, receiver.youAreOwed - amountPaid);
            await ower.save();
            await receiver.save();
        }
        res.status(200).json({ success: true, expense, message: "Assignment marked as paid" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

//send the data of from to to to frontend
exports.Settlements = async (req, res) => {
    try {
        const { group } = req.body;

        if (!group) {
            return res.status(400).json({ success: false, message: "Group ID missing" });
        }

        // Find expense by group field, not by _id
        const expense = await Expense.find({ group }).populate("assignments");

        if (!expense || expense.length === 0) {
            return res.status(404).json({ success: false, message: "The bill (expense) doesn't exist" });
        }

        const allAssignments = expense
            .flatMap(exp =>
                exp.assignments
                    .filter(a => a.from.toString() !== a.to.toString())
                    .map(a => ({
                        _id: a._id,
                        from: a.from,
                        to: a.to,
                        amount: a.amount,
                        expenseId: exp._id,
                        isPaid: a.isPaid || false,
                        paidAt: a.paidAt || null
                    }))
            );


        res.status(200).json({
            success: true,
            allAssignments,
            message: "Settlement sent to frontend"
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
