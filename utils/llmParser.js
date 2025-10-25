const axios = require("axios");

async function parseBillText(ocrText) {
  const prompt = `
  Extract all items from this restaurant bill and return ONLY valid JSON.
  Each item should include:
  - name (string)
  - price (number, per unit)
  - quantity (number, if mentioned; otherwise assume 1)
  Also include the total bill amount as "total".

  Example format:
  {
    "items": [
      { "name": "Paneer Butter Masala", "price": 80, "quantity": 2," },
      { "name": "Kerala Parata", "price": 20, "quantity": 4 }
    ],
    "total": 240
  }

  Bill text:
  ${ocrText}
  `;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    const modelResponse =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 1️⃣ Extract JSON cleanly using regex
    const jsonMatch = modelResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in model response:", modelResponse);
      return null;
    }

    // 2️⃣ Parse safely
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    console.error("Gemini Parsing Error:", err.message);
    return null;
  }
}

module.exports = parseBillText;
