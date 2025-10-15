const Tesseract = require("tesseract.js");

async function extractTextFromImage(filepath)
{
    try{
        const result = await Tesseract.recognize(filepath,"eng");
        return result.data.text;
    }
    catch(error)
    {
        throw new Error("OCR failed! " + error.message);
    }
}

module.exports = extractTextFromImage;