const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadBill, parseBill, assignMoney, recordPayment, splitExpense, getBillDetails, settleAssignments } = require("../controllers/billController");
const { parse } = require("path");

router.post("/upload", auth,upload.single("bill"),uploadBill);
// router.post("/parse",auth,parseBill);
router.get("/getBillDetails/:expenseId",auth,getBillDetails);

router.patch("/assign-money",auth,assignMoney);
router.post("/settleAssignment",auth,settleAssignments);
router.post("/payment",auth,recordPayment);
router.get("/split/:expenseId",auth,splitExpense);
module.exports = router;
