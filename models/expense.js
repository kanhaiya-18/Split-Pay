// models/Expense.js
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    method: { type: String }, // optional (UPI, cash, card...)
    createdAt: { type: Date, default: Date.now }
});

const assignmentSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // owes money
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },   // to be paid
    amount: { type: Number, required: true },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date }
});


const itemSchema = new mongoose.Schema({
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});

const expenseSchema = new mongoose.Schema({
    billName: { type: String, required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    billImageUrl: String,
    items: [itemSchema],
    splitMethod: { type: String, enum: ["equal", "per-item", "money"], default: "equal" },
    totalAmount: { type: Number, default: 0 },

    // NEW:
    payments: [paymentSchema],       // who actually paid
    assignments: [assignmentSchema], // money-only assignments by frontend

    // optional cache
    splitSummary: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amountOwed: Number
    }]
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);
