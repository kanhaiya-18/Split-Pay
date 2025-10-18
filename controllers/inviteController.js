const Group = require("../models/Group");
const User = require("../models/user");
const Invite = require("../models/invite");

exports.sendInvite = async(req,res) => {
    try{
        //get the group name and friend's email from body
        const {groupId,friendMail} = req.body;
        //get the senders id 
        const senderId = req.user.id;
        //find the group
        const group = await Group.findById(groupId);
        if(!group)
        {
            return res.status(404).json({
                success: false,
                message: "Group not found"
            });
        }
        //find the receiver
        const receiver = await User.findOne({email: friendMail});
        if(!receiver)
        {
            return res.status(404).json({success : false, message: "User not found"});
        }
        //check if the receiver is already in the group
        if(group.members.includes(receiver._id))
        {
            return res.status(400).json({ success: false, message: "User already in group" });
        }
        //now create the link
        const inviteLink = await Invite.create({
            group : groupId, 
            sender:  senderId,
            receiver : receiver._id
        });
        return res.status(200).json({
            success : true,
            message: `the invite link sent successfully to ${receiver.email}`,
            inviteLink
        });
    }
    catch(err)
    {
        return res.status(500).json({
            success : false,
            message: `something went wrong ${err.message}`
        });
    }
}
//accept the invite 
exports.acceptInvite = async(req,res) => {
    try{
        const {inviteId} = req.body;
        const userId = req.user.id;

        const invite = await Invite.findById(inviteId).populate("group");
        if(!invite){
            return res.status(404).json({success: false,message : "the invite doesn't exits"});
        }
        //check if the invity and the current user are same 
        if(invite.receiver.toString() !== userId)
        {
            return res.status(403).json({success: false,message: "not authorized"});
        }
        //now add the user to the group
        const group = await Group.findById(invite.group._id);
        group.members.push(userId);
        await group.save();

        invite.status = "accepted";
        await invite.save();

        res.status(200).json({
            success: true,
            message : "the invite is accepted and added to the group",
            group
        });
    }
    catch(err)
    {
        res.status(500).json({
            success : false,
            message: err.message
        });
    }
}
//reject the invite 
exports.rejectInvite = async(req,res) => {
    try{
        //get the invite id 
        const {inviteId} = req.body;
        const userId = req.user.id; //user id 

        const invite = await Invite.findById(inviteId).populate("group");
        if(!invite)
        {
            return res.status(404).json({success : false, message : "invite doesn't exists"});
        }
        //match the user and invite's id 
        if(invite.receiver.toString() !== userId)
        {
            return res.status(403).json({success: false,message: "not authorized"});
        }
        //now reject the invite
        invite.status = "rejected";
        await invite.save();
        return res.status(200).json({
            success : true,
            message:  "rejected the link to join the group"
        })

    }
    catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

//get all the pending invites
exports.getPendingInvite = async(req,res) =>{
    try{
        const userId = req.user.id;
        const invites = await Invite.find({
            receiver : userId,
            status : "pending"
        })
        .populate("group" , "groupName")
        .populate("sender" , "name email");
        res.status(200).json({ success: true, count: invites.length, invites });
    }
    catch(errr)
    {
        res.status(500).json({success: false, message : errr.message});
    }
}