const mongoose = require("mongoose");
const expenseSchema = new mongoose.Schema({
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    billImageUrl: String,
    items: [{
        name: String,
        price: Number,
        quantity: {type: Number,default : 1},
        assignedTo: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    }],
    splitMethod: {
        type: String,
        enum: ["equal", "per-item"],
        default: "equal"
    },
    totalAmount: Number

},{timestamps: true});

module.exports = mongoose.model("Expense",expenseSchema);