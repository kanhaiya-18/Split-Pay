const Expense = require("../models/expense");
const extractTextFromImage = require("../utils/ocr");
const parseBillText = require("../utils/llmParser");

exports.uploadBill = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        //run ocr
        const text = await extractTextFromImage(req.file.path);

        const expense = await Expense.create({
            group: req.body.groupId,
            createdBy: req.user.id,
            billImageUrl: req.file.path,
            totalAmount: 0, // will update after parsing
            items: []
        });
        res.status(200).json({
            success: true,
            expenseId : expense._id,
            rawText : text,
            message : "bill uploaded and ocr extracted"
        });
    }
    catch(err)
    {
        res.status(500).json({
            success: false,
            message : err.message
        });
    }
};


// Parse OCR output into structured data
exports.parseBill = async (req, res) => {
    try {
        const { expenseId, rawText } = req.body;
        if (!expenseId || !rawText) {
            return res.status(400).json({ success: false, message: "Missing expenseId or rawText" });
        }

        const structuredData = await parseBillText(rawText);

        if (!structuredData) {
            return res.status(500).json({ success: false, message: "Failed to parse bill text" });
        }

        // Calculate total amount
        const total = structuredData.total || structuredData.items.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);

        // Update the Expense with parsed data
        const updatedExpense = await Expense.findByIdAndUpdate(
            expenseId,
            { items: structuredData.items, totalAmount: total },
            { new: true }
        );

        res.status(200).json({
            success: true,
            expense: updatedExpense,
            message: "Bill parsed and saved successfully"
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
