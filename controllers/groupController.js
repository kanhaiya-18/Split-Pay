const Expense = require("../models/expense");
const Group = require("../models/Group");
const User = require("../models/user");

//creation of group
exports.createGroup = async (req, res) => {
    try {
        const { name, mems } = req.body;
        const members = []
        if(mems)
        members.push(mems)
        members.push(req.user.id);
        const makegroup = await Group.create({ name, members, createdBy: req.user.id });
        if (!makegroup) {
            return res.status(400).json({
                success: false,
                message: "couldn't create group"
            });
        }
        // Fetch with populated details
        const populatedGroup = await Group.findById(makegroup._id)
            .populate('members', 'name email')
            .populate('createdBy', 'name email');

        res.status(200).json({
            success: true,
            group : populatedGroup,
            message: "group created successfully!!"
        })
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

//get the info about the group (handle get request)
exports.getGroup = async (req, res) => {
    try {
        const id = req.params.id || req.body.id;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Group ID is required"
            });
        }

        // Populate members and creator details
        const populatedGroup = await Group.findById(id)
            .populate('members', 'name email')
            .populate('createdBy', 'name email');

        if (!populatedGroup) {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }

        res.status(200).json({
            success: true,
            group: populatedGroup,
            message: "Group details fetched successfully"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

//get all the details of the groups that a perticular person is in
exports.getAllGroup = async(req,res) =>{
    try{
        //get the id of the person
        const id = req.user.id;
        if(!id)
        {
            return res.status(400).json({
                success: false,
                message: "no such person exist"
            });
        }
        const groups = await Group.find({
            $or : [
                {createdBy : id},
                {members : id}
            ]
        })
        .populate("members" , "name email")
        .populate("createdBy", "name email");
        if(!groups.length)
        {
            return res.status(400).json({
                success : false,
                message : "the person is not in any group"
            });
        }
        return res.status(200).json({
            success : true,
            message : "fetched data successfully",
            groups
        })

    }catch(err)
    {
        return res.status(500).json({
            success : false,
            message : err.message
        });
    }
}

//delete the group
exports.deleteGroup = async(req,res)=>{
    try
    {
        const id = req.params.id || req.body.id;
        if(!id)
        {
            return res.status(400).json({
                success: false,
                message: "group doesn't exist"
            });
        }
        await Group.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: "succussfully deleted the group"
        });
    }
    catch(err)
    {
        return res.status(500).json({
            success: false,
            message: `couldn't delete the group ${err.message}`
        });
    }
}

//get the balances of all the members of the group
exports.getBalance = async (req, res) => {
    try {
        const groupId = req.params.groupId || req.params.groudId || req.params.id || req.query.groupId || req.body.groupId;
        if (!groupId) {
            return res.status(400).json({ success: false, message: "Group ID is required" });
        }

        // 1. Fetch group details
        const group = await Group.findById(groupId).populate("members", "name email");
        if (!group) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        // 2. Fetch all expenses for this group
        const expenses = await Expense.find({ group: groupId })
            .populate("paidBy", "name email")
            .populate("assignments.from", "name email")
            .populate("assignments.to", "name email");

        // 3. Initialize member balances map
        const memberMap = new Map();
        for (const member of group.members) {
            memberMap.set(member._id.toString(), {
                userId: member._id,
                name: member.name,
                email: member.email,
                totalPaid: 0,
                totalAssigned: 0,
                netBalance: 0
            });
        }

        const pendingAssignments = [];

        // 4. Calculate total paid, assigned, and pending debts across all expenses
        for (const exp of expenses) {
            // Add paid total for the payer
            const payerId = exp.paidBy ? exp.paidBy._id.toString() : (exp.assignments[0]?.to ? (exp.assignments[0].to._id || exp.assignments[0].to).toString() : null);
            
            if (payerId && memberMap.has(payerId)) {
                const payerData = memberMap.get(payerId);
                payerData.totalPaid += (exp.totalAmount || 0);
            }

            // Process assignments
            for (const a of exp.assignments || []) {
                if (!a.from) continue;
                const debtorId = (a.from._id || a.from).toString();

                if (memberMap.has(debtorId)) {
                    const debtorData = memberMap.get(debtorId);
                    debtorData.totalAssigned += (a.amount || 0);
                }

                // Collect pending unpaid assignments
                if (!a.isPaid && a.amount > 0) {
                    pendingAssignments.push({
                        expenseId: exp._id,
                        billName: exp.billName,
                        assignmentId: a._id,
                        from: a.from,
                        to: a.to || exp.paidBy,
                        amount: a.amount
                    });
                }
            }
        }

        // 5. Compute net balance for each member (paid - assigned)
        const memberBalances = [];
        for (const memberData of memberMap.values()) {
            memberData.netBalance = parseFloat((memberData.totalPaid - memberData.totalAssigned).toFixed(2));
            memberBalances.push(memberData);
        }

        // 6. Compute overall simplified group settlements
        const debtors = memberBalances.filter(m => m.netBalance < 0).map(m => ({ ...m, net: Math.abs(m.netBalance) }));
        const creditors = memberBalances.filter(m => m.netBalance > 0).map(m => ({ ...m, net: m.netBalance }));
        const groupSettlements = [];

        for (const debtor of debtors) {
            let amountOwed = debtor.net;
            for (const creditor of creditors) {
                if (amountOwed <= 0) break;
                if (creditor.net <= 0) continue;

                const settleAmount = Math.min(amountOwed, creditor.net);
                if (settleAmount > 0) {
                    groupSettlements.push({
                        from: {
                            id: debtor.userId,
                            name: debtor.name,
                            email: debtor.email
                        },
                        to: {
                            id: creditor.userId,
                            name: creditor.name,
                            email: creditor.email
                        },
                        amount: parseFloat(settleAmount.toFixed(2))
                    });

                    debtor.net -= settleAmount;
                    creditor.net -= settleAmount;
                    amountOwed -= settleAmount;
                }
            }
        }

        return res.status(200).json({
            success: true,
            group: {
                id: group._id,
                name: group.name,
                membersCount: group.members.length
            },
            memberBalances,
            groupSettlements,
            pendingAssignments,
            message: "Group balances and settlements fetched successfully"
        });

    } catch (err) {
        console.error("Error in getBalance:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};