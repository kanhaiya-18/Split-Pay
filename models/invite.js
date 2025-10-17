const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
    group : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required : true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required : true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required : true
    },
    status:{
        type: String,
        enum: ["pending","accepted","rejected"],
        default: "pending"
    }
},{timestamps: true});
module.exports = mongoose.model("Invite",inviteSchema);