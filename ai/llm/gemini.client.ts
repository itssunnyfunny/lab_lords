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
    } catch (error: unknown) {
        const name = error instanceof Error ? error.name : "UnknownError";
        const message = error instanceof Error ? error.message : String(error);
        console.error("❌ Gemini API Call Failed!");
        console.error("Error Name:", name);
        console.error("Error Message:", message);

        if (message.includes("429") || message.includes("quota")) {
            console.error("🚨 QUOTA EXCEEDED: You are sending too many requests to Gemini.");
        }

        if (error instanceof Error && error.stack) console.error("Stack:", error.stack);
        return null;
    }
}
