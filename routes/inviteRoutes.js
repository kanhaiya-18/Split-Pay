const express = require("express");
const { sendInvite, acceptInvite, rejectInvite, getPendingInvite } = require("../controllers/inviteController");
const auth= require("../middleware/auth");
console.log(sendInvite, acceptInvite, rejectInvite, auth);
const router = express.Router();

router.post("/group/invite",auth,sendInvite);
router.post("/group/invite/accept",auth,acceptInvite);
router.post("/group/invite/reject",auth,rejectInvite);
router.get("/group/invite/pending",auth,getPendingInvite);
module.exports = router;