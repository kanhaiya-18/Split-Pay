const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadBill,  assignMoney, recordPayment, splitExpense, getBillDetails, settleAssignments, assignEqually, Settlements, markAssignmentPaid, getAllBills } = require("../controllers/billController");
// const { parse } = require("path");

router.post("/upload", auth,upload.single("bill"),uploadBill);
// router.post("/parse",auth,parseBill);
router.get("/getBillDetails/:expenseId",auth,getBillDetails);

router.patch("/assign-money",auth,assignMoney);
router.patch("/assign-Equally",auth,assignEqually);
router.post("/settleAssignment",auth,settleAssignments);
router.post("/markAsPaid",auth,markAssignmentPaid);
router.get("/getAssignments",auth, Settlements);
router.post("/payment",auth,recordPayment);
router.get("/split/:expenseId",auth,splitExpense);
router.get("/getAllBills", auth, getAllBills);
module.exports = router;
