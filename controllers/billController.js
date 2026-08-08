const Expense = require("../models/expense");
const Group = require("../models/Group");
const User = require("../models/user");
const mongoose = require("mongoose");
const extractTextFromImage = require("../utils/ocr");
const parseBillText = require("../utils/llmParser");

// Create a manual bill (no OCR/LLM)
exports.createManualBill = async (req, res) => {
    try {
        const {
            groupId,
            billName,
            items = [],
            totalAmount,
            splitMethod,
            assignments = [],
            payments = [],
            billImageUrl
        } = req.body;

        if (!groupId || !billName) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: groupId, billName"
            });
        }

        const computedTotal = typeof totalAmount === "number"
            ? totalAmount
            : (Array.isArray(items)
                ? items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
                : 0);

        const allowedSplit = ["equal", "per-item", "money"]; 
        const finalSplitMethod = allowedSplit.includes(splitMethod) ? splitMethod : "equal";

        const sanitizedAssignments = Array.isArray(assignments)
            ? assignments
                .filter(a => a && a.from && a.to && typeof a.amount === "number")
                .map(a => ({ from: a.from, to: a.to, amount: a.amount }))
            : [];

        const sanitizedPayments = Array.isArray(payments)
            ? payments
                .filter(p => p && p.user && typeof p.amount === "number")
                .map(p => ({ user: p.user, amount: p.amount, method: p.method || "cash" }))
            : [];

        const expense = await Expense.create({
            billName: (billName || "").trim() || "Untitled Bill",
            group: groupId,
            createdBy: req.user.id,
            paidBy: req.body.paidBy || req.user.id,
            billImageUrl: billImageUrl || undefined,
            totalAmount: computedTotal,
            items: Array.isArray(items) ? items : [],
            splitMethod: finalSplitMethod,
            assignments: sanitizedAssignments
        });

        // Update user tallies based on assignments (mirror settleAssignments behavior)
        for (const a of sanitizedAssignments) {
            if (!a || typeof a.amount !== "number" || a.amount <= 0) continue;
            const fromId = a.from?.toString();
            const toId = a.to?.toString();
            if (!fromId || !toId || fromId === toId) continue;
            await User.findByIdAndUpdate(toId, { $inc: { youAreOwed: a.amount } });
            await User.findByIdAndUpdate(fromId, { $inc: { youOwe: a.amount } });
        }

        return res.status(200).json({
            success: true,
            expense,
            message: "Manual expense created successfully"
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// Get all bills for a specific group (group id from query parameter)
exports.getAllBills = async (req, res) => {
    try {
        const { group } = req.query;
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

        //  Extract text from image (OCR)
        const text = await extractTextFromImage(req.file.path);
        // console.log("🧾 Extracted Text:", text);

        //  Parse structured data using Gemini
        const structuredData = await parseBillText(text);

        if (!structuredData || !structuredData.items) {
            return res.status(500).json({
                success: false,
                message: "Failed to parse bill text from Gemini",
            });
        }

        // Step 3: Calculate total amount if Gemini didn't provide one
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

        //Step 4: Create Expense in MongoDB with parsed details
        const expense = await Expense.create({
            billName,
            group: req.body.groupId,
            createdBy: req.user.id,
            paidBy: req.body.paidBy || req.user.id,
            billImageUrl: req.file.path,
            totalAmount: total,
            items: structuredData.items,
            splitMethod: "equal",
        });

        //  Step 5: Send structured data to frontend
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
        const { expenseId, assignments,paidBy } = req.body;
        if (!expenseId || !assignments || !paidBy) {
            return res.status(400).json({ success: false, message: "expenseId or assignment or paidBy doesn't exist" });
        }
        // get the expense from expenseId
        const expense = await Expense.findById(expenseId).populate("group");
        if (!expense) {
            return res.status(404).json({ success: false, message: "expense not found" });
        }
        //validate the paidBy user
        const validPaidUser = await User.findById(paidBy);
        if(!validPaidUser){
            return res.status(401).json({success : false, message: "not a valid user who paid"})
        }
        // validate users belong to the group
        const groupMembersIds = (await Group.findById(expense.group._id)).members.map(m => m.toString());
        let sumAssigned = 0;
        // Validate users belong to group
        for (let a of assignments) {
            if (!a.from || typeof a.amount !== "number") {
                return res.status(400).json({ success: false, message: "Each assignment needs from, to, and numeric amount" });
            }
            if (!groupMembersIds.includes(a.from.toString())) {
                return res.status(400).json({ success: false, message: `Invalid assignment: ${a.from} not in group` });
            }
            // sumAssigned += Number(a.amount || 0);
        }

        //now save assignment
        expense.assignments = assignments.map(a => ({
            from: a.from, // who owes
            to: paidBy,     // who should receive
            amount: a.amount
        }));
        expense.paidBy = paidBy;

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
            if (userId === paidBy) continue;
            assignments.push({
                from: userId,
                to: paidBy,
                amount: perUserAmount
            });
        }
        expense.assignments = assignments;
        expense.paidBy = paidBy;
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
        if (expense.isSettled) {
            return res.status(400).json({ success: false, message: "Assignments for this bill are already settled" });
        }
        for (const a of expense.assignments) {
            if (!a || a.amount <= 0) continue;

            const fromId = a.from?._id?.toString() || a.from?.toString();
            const toId = a.to?._id?.toString() || a.to?.toString();

            if (!fromId || !toId || fromId === toId) continue;

            // Increase receiver’s “youAreOwed”
            await User.findByIdAndUpdate(toId, {
                $inc: { youAreOwed: a.amount }
            });

            //  Increase payer’s “youOwe”
            await User.findByIdAndUpdate(fromId, {
                $inc: { youOwe: a.amount }
            });
        }
        
        expense.isSettled = true;
        await expense.save();

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
// exports.recordPayment = async (req, res) => {
//     try {
//         const { expenseId, amount, method, paidBy } = req.body;
//         const requestedId = req.user.id;
//         const payerId = paidBy || requestedId;

//         if (!expenseId || !amount) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Please provide expenseId and amount"
//             });
//         }

//         //  Find the expense
//         const expense = await Expense.findById(expenseId).populate("group");
//         if (!expense) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Expense not found"
//             });
//         }

//         // Find the group
//         const group = await Group.findById(expense.group);
//         if (!group) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Group not found"
//             });
//         }

//         // Validate that both users are group members
//         const groupMemberIds = group.members.map(m => m.toString());
//         if (!groupMemberIds.includes(requestedId)) {
//             return res.status(403).json({
//                 success: false,
//                 message: "You are not a member of this group"
//             });
//         }

//         if (!groupMemberIds.includes(payerId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "The specified payer is not a member of this group"
//             });
//         }
//         //Actually record the payment now
//         if (!expense.payments) expense.payments = [];
//         expense.payments.push({
//             user: payerId,
//             amount,
//             method: method || "cash"
//         });

//         // Save the expense
//         await expense.save();

//         //  Fetch populated version for clean response
//         const updatedExpense = await Expense.findById(expenseId)
//             .populate("payments.user", "name email")
//             .populate("assignments.user", "name email")
//             .populate("group", "groupName");
//         //update the user db 
//         // const UpdatedinUser = await User.findByIdAndUpdate(
//         //     payerId,
//         //     { $inc: { youAreOwed: amount } },
//         //     { new: true }
//         // );
//         if (!UpdatedinUser) {
//             return res.status(400).json({ success: false, message: "it has not been updated in userDB" });
//         }
//         // Return
//         return res.status(200).json({
//             success: true,
//             message: `Payment of ₹${amount} recorded successfully (paid by user ${payerId})`,
//             expense: updatedExpense
//         });
//     } catch (err) {
//         console.error("Error in recordPayment:", err);
//         return res.status(500).json({
//             success: false,
//             message: err.message
//         });
//     }
// };


exports.splitExpense = async (req, res) => {
    try {
        const { expenseId } = req.params;

        // Fetch expense with populated fields
        const expense = await Expense.findById(expenseId)
            .populate("paidBy", "name email")
            .populate("assignments.from", "name email")
            .populate("assignments.to", "name email")
            .populate("group", "name members")
            .populate("createdBy", "name email");

        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found" });
        }

        // Determine the single payer (paidBy)
        let payerUser = expense.paidBy;
        if (!payerUser && expense.assignments.length > 0 && expense.assignments[0].to) {
            payerUser = expense.assignments[0].to;
        }

        const totalAmount = expense.totalAmount || 0;
        const payerId = payerUser ? payerUser._id.toString() : null;

        // Map assigned amounts per user
        const assignedMap = {};
        for (const a of expense.assignments || []) {
            if (!a.from) continue;
            const fromId = typeof a.from === "object" ? a.from._id.toString() : a.from.toString();
            assignedMap[fromId] = (assignedMap[fromId] || 0) + (a.amount || 0);
        }

        // Calculate total amount assigned to other members
        const totalAssignedToOthers = Object.values(assignedMap).reduce((sum, val) => sum + val, 0);

        // Build perUser list
        const perUser = [];
        const userMap = new Map();

        // 1. Add payerUser entry
        if (payerUser) {
            const payerShare = Math.max(0, parseFloat((totalAmount - totalAssignedToOthers).toFixed(2)));
            userMap.set(payerId, {
                userId: payerId,
                name: payerUser.name,
                email: payerUser.email,
                assigned: payerShare,
                paid: totalAmount,
                net: totalAssignedToOthers // Positive net balance owed to payer
            });
        }

        // 2. Add debtor entries from assignments
        for (const a of expense.assignments || []) {
            if (!a.from) continue;
            const fromUser = typeof a.from === "object" ? a.from : null;
            const fromId = fromUser ? fromUser._id.toString() : a.from.toString();

            if (fromId === payerId) continue;

            const assignedAmt = a.amount || 0;
            userMap.set(fromId, {
                userId: fromId,
                name: fromUser ? fromUser.name : "Unknown",
                email: fromUser ? fromUser.email : "",
                assigned: assignedAmt,
                paid: 0,
                net: -assignedAmt // Negative net balance owed by debtor
            });
        }

        perUser.push(...Array.from(userMap.values()));

        // Build settlements list (who owes paidBy)
        const settlements = (expense.assignments || []).map(a => {
            const fromUser = typeof a.from === "object" ? a.from : { name: "Unknown" };
            const toUser = typeof a.to === "object" ? a.to : (payerUser || { name: "Payer" });

            return {
                assignmentId: a._id,
                from: {
                    id: fromUser._id,
                    name: fromUser.name,
                    email: fromUser.email
                },
                to: {
                    id: toUser._id,
                    name: toUser.name,
                    email: toUser.email
                },
                amount: a.amount,
                isPaid: a.isPaid || false,
                paidAt: a.paidAt || null
            };
        });

        res.status(200).json({
            success: true,
            expenseId: expense._id,
            billName: expense.billName,
            totalAmount,
            paidBy: payerUser ? { id: payerUser._id, name: payerUser.name, email: payerUser.email } : null,
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
        const remAmount = assignment.amount - amountPaid;

        assignment.isPaid = remAmount <= 0 ? true : false;
        if (assignment.isPaid){
            assignment.paidAt = new Date();
            assignment.amount = 0;
        }
            

        if(!assignment.isPaid){
            return res.status(400).json({
                success: false,
                message: "the amount is not enough"
            })
        }
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

exports.deleteBill = async (req, res) => {
    try {
        const { expenseId } = req.body;

        if (!expenseId) {
            return res.status(400).json({
                success: false,
                message: "Expense ID is required.",
            });
        }

        const expense = await Expense.findById(expenseId);
        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "No expense found with this ID.",
            });
        }

        // Handle assignments and adjust user balances
        const assignments = expense.assignments || [];

        for (const a of assignments) {
            const { from, to, amount } = a;

            const userFrom = await User.findById(from);
            const userTo = await User.findById(to);

            if (userFrom) {
                userFrom.youOwe = (userFrom.youOwe || 0) - amount;
                await userFrom.save();
            }

            if (userTo) {
                userTo.youAreOwed = (userTo.youAreOwed || 0) - amount;
                await userTo.save();
            }
        }

        // Delete the expense
        const deletedExpense = await Expense.findByIdAndDelete(expenseId);

        return res.status(200).json({
            success: true,
            message: "Expense deleted successfully.",
            deletedExpense,
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message || "Server error while deleting expense.",
        });
    }
};
