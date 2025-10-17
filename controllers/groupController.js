const Group = require("../models/Group");

//creation of group
exports.createGroup = async (req, res) => {
    try {
        const { name, members } = req.body;
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