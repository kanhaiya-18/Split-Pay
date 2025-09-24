const express = require("express");
const router = express.Router();

//import controllers
const {signUp,login} = require("../controllers/authController");
const {createGroup, getGroup} = require("../controllers/groupController");

//import middleware 
const auth = require("../middleware/auth");

router.post("/signUp",signUp);
router.post("/login",login);
router.post("/group/create",auth,createGroup);
router.get("/group/get/:id",auth,getGroup);
module.exports = router;