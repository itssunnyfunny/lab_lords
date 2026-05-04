
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config({ path: './.env' });

console.log("🚀 Script started...");

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log("--------------------------------------------------");
    console.log("🧪 GEMINI API CONNECTIVITY TEST");
    console.log("--------------------------------------------------");

    if (!apiKey) {
        console.error("❌ ERROR: GEMINI_API_KEY is missing in process.env");
        console.log("   Please check your .env file.");
        process.exit(1);
    }

    // Mask key for safety in logs
    const maskedKey = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`🔑 API Key Found: ${maskedKey}`);

    try {
        console.log("🤖 Initializing GoogleGenAI client...");
        const genAI = new GoogleGenAI({ apiKey: apiKey });

        console.log("📡 Sending test request to model: 'gemini-2.0-flash'...");
        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: "Hello, are you working?" }],
                },
            ],
        });

        console.log("--------------------------------------------------");
        console.log("✅ RESPONSE RECEIVED:");
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(text || JSON.stringify(response, null, 2));
        console.log("--------------------------------------------------");
        console.log("🎉 TEST PASSED! The API key and client are working.");

    } catch (error: unknown) {
        const name = error instanceof Error ? error.name : "UnknownError";
        const message = error instanceof Error ? error.message : String(error);
        console.error("--------------------------------------------------");
        console.error("❌ TEST FAILED!");
        console.error("--------------------------------------------------");
        console.error("Error Name:", name);
        console.error("Error Message:", message);
        if (error instanceof Error && error.stack) console.error("Stack:", error.stack);

        if (message.includes("404")) {
            console.log("\n💡 TIP: 'gemini-2.0-flash' might not be available or the model name is wrong. Try 'gemini-1.5-flash'.");
        }
    }
}

testGemini();
