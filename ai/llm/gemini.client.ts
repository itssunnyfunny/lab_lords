import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("⚠️ WARNING: GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenAI({ apiKey: apiKey || "dummy-key" });

export async function callGemini(prompt: string): Promise<string | null> {
    if (!apiKey) {
        console.error("❌ Aborting Gemini call: Missing API Key.");
        return null;
    }

    try {
        console.log("🤖 Calling Gemini with model: gemini-2.5-flash");
        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }],
                },
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("✅ Gemini Response Logic:", text ? "Success" : "Empty");
        return text ?? null;
    } catch (error: any) {
        console.error("❌ Gemini API Call Failed!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);

        if (error.message?.includes("429") || error.message?.includes("quota")) {
            console.error("🚨 QUOTA EXCEEDED: You are sending too many requests to Gemini.");
        }

        if (error.stack) console.error("Stack:", error.stack);
        return null;
    }
}
