const user = require("../models/user");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require("dotenv").config();

//controller for signup 
exports.signUp = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "fill all the details"
            })
        }
        //check if user already signed up 
        const existingUser = await user.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "the user already exists"
            });
        }
        //if not then store the name , email and password 
        //first let's hash the password 
        const hashpass = await bcrypt.hash(password, 10);
        const newUser = await user.create({ name, email, password: hashpass });
        
        //generate the token
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "10h" });
        newUser.password = undefined;
        res.status(200).json({
            success: true,
            message: "signed Up successfully",
            token,
            user: newUser
        })
    }
    catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
}
//controller for updating profile
exports.updateProfile = async (req, res) => {
    try{
        const { name,email } = req.body;
        const updatedUser = await user.findOneAndUpdate({email}, { name }, { new: true });
        if(!updatedUser){
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });
    }
    catch(error){
        res.status(500).json({
            message: error.message
        });
    }
};
//controller for changing password
exports.changePassword = async (req, res) => {
    try{
        const { email, oldPassword, newPassword } = req.body;
        const existingUser = await user.findOne({ email });
        if(!existingUser){
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        const isMatch = await bcrypt.compare(oldPassword, existingUser.password);
        if(!isMatch){
            return res.status(400).json({
                success: false,
                message: "Old password is incorrect"
            });
        }
        const hashNewPass = await bcrypt.hash(newPassword, 10);
        existingUser.password = hashNewPass;
        await existingUser.save();
        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });
    }
    catch(err)
    {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
//controller for login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        //check if user has written all the details
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "fill all the details"
            })
        }
        //check if user exists or not 
        const existingUser = await user.findOne({email});
        if (!existingUser) {
            return res.status(400).json({
                success: false,
                message: "invalid credentials"
            });
        }

        //let's match the email and password
        const isMatch = await bcrypt.compare(password,existingUser.password);
        if (!isMatch) return res.status(400).json({ 
            success : false,
            message: "Invalid credentials" 
        });
        const token = jwt.sign({ id: existingUser._id }, process.env.JWT_SECRET, { expiresIn: "10h" });
        existingUser.password = undefined;
        res.status(200).json({
            success: true,
            message: "Logged in  successfully",
            token,
            user:existingUser
        });
        
    }catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};
//controller for getting user details
exports.getUserDetails = async (req, res) => {
    try {
        const id = req.user.id;
        const existingUser = await user.findById(id)
        .select("name email youOwe youAreOwed") 
        .populate("youOwe" , "name email")
        .populate("youAreOwed" , "name email");
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        res.status(200).json({
            success: true,
            user: existingUser,
            message: "User details fetched successfully"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }

};
