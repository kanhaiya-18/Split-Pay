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
}