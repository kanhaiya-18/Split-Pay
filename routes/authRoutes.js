const express = require("express");
const router = express.Router();

//import controllers
const {signUp,login,updateProfile, changePassword, getUserDetails} = require("../controllers/authController");
const {createGroup, getGroup, deleteGroup, getAllGroup} = require("../controllers/groupController");

//import middleware 
const auth = require("../middleware/auth");

router.post("/signUp",signUp);
router.post("/login",login);
router.patch("/updateProfile",auth,updateProfile);
router.patch("/changePassword",auth,changePassword);
router.get("/getUserDetails",auth,getUserDetails);
router.post("/group/create",auth,createGroup);
router.get("/group/get/:id",auth,getGroup);
router.get("/group/getAll",auth,getAllGroup);
router.delete("/group/delete/:id",auth,deleteGroup);
module.exports = router;