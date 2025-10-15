const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadBill, parseBill } = require("../controllers/billController");
const { parse } = require("path");

router.post("/upload", auth,upload.single("bill"),uploadBill);
router.post("/parse",auth,parseBill);
module.exports = router;
