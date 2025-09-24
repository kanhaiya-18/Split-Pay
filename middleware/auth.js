const jwt = require("jsonwebtoken");
require("dotenv").config();
const auth = async(req,res,next)=>{
    try{
        const token = req.header("Authorization").replace("Bearer ","");
        if(!token)
        {
            return res.status(401).json({
                success: false,
                message: "No token provided" 
            });
        }
        //verify the token
        const decode = jwt.verify(token,process.env.JWT_SECRET);
        req.user = decode;
        next();
    }
    catch (err) {
        console.error(err);
        return res.status(401).json({
            success: false,
            message: "Invalid token. Access denied"
        });
    }
}
module.exports = auth;