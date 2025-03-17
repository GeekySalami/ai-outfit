import { GoogleGenerativeAI } from "@google/generative-ai";
import { processImages } from "./utils/processImages.js";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { raw } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.PATH_TO_ENV = path.resolve(__dirname, "../.env");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const analyzer = async (req, res) => {
  try {
    const selectedstyle = req.body.style;
    const imageUrls = await processImages(req);

    const formatExample = JSON.stringify([
      {
        outfit_id: 0,
        clothes: ["image0", "image1", "image2"],
        score: 10,
        considerations: "",
      },
    ]);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Convert images into base64 encoding for inline_data
    const imagesContent = imageUrls.map((url, index) => ({
      inline_data: {
        data: url, // Ensure 'url' is the base64 string
        mime_type: "image/jpeg",
      },
    }));

    // Construct the text prompt
    const textContent = {
      text: `I have a collection of images encoded in base64, they are clothing images. I need to create multiple outfits for a 25 to 30-year-old female in a ${selectedstyle} style. 
Based on these images, first analyze them based on color, style, and texture. Then mix and match the clothes to form 1-5 outfits. Each outfit should be a combination of 2 to 4 pieces.

For each outfit, provide a list that includes:
- An outfit identifier (outfit_id) (auto-generated)
- A list of clothes_id you selected for this outfit, where clothes_id is the 0-based index of the image provided in the collection, in the format of image+index
- A score from 0 to 10, reflecting how well the outfit matches the ${selectedstyle} style.
- A short description explaining your rationale for this outfit.

Only return JSON output in the following format:, as follows:
${formatExample}.`,
    };

    // Construct the request message
    const message = [
      {
        parts: [...imagesContent, textContent],
      },
    ];

    // Call Gemini API
    const generatedContent = await model.generateContent({ contents: message });

    // Await the text response properly
    const responseText = await generatedContent.response.text();
    console.log("Response text:", responseText);
    const match = responseText.match(/```([\s\S]+?)```/);
    let extractedText = match ? match[1].trim() : responseText;
    extractedText = `\`\`\`${extractedText}\`\`\``
    console.log("Extracted text:", extractedText);

    const cleanedText = responseText.replace(/^```json|```$/g, "").trim();
    console.log("Cleaned response text:", cleanedText);

    const responseJson = JSON.parse(cleanedText);
    console.log(responseJson);
    console.log("🟢 Final JSON to send:", responseJson);
    if (!res.headersSent) {
      res.status(200).json({ message: responseJson });
      console.log("✅ Sent response to frontend!");
    } else {
      console.error("❌ Headers already sent, response blocked!");
    }
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ message: `Error calling Gemini API: ${error.message}` });
    }
  }
};

export { analyzer };
