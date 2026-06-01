import { GoogleGenAI } from "@google/genai";

type GeminiCallOptions = {
    model?: string;
    responseMimeType?: "application/json" | "text/plain";
};

export const DEFAULT_GEMINI_FLASH_MODEL = "gemini-3-flash-preview";
export const DEFAULT_GEMINI_PRO_MODEL = "gemini-3-pro-preview";

let genAI: GoogleGenAI | null = null;
let warnedMissingKey = false;

function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        if (!warnedMissingKey) {
            console.warn("WARNING: GEMINI_API_KEY is not set in environment variables.");
            warnedMissingKey = true;
        }
        return null;
    }

    if (!genAI) genAI = new GoogleGenAI({ apiKey });
    return genAI;
}

function compactModelName(model: string) {
    return model.trim();
}

function normalizeGeminiModel(model: string) {
    const value = compactModelName(model);
    const aliases: Record<string, string> = {
        "gemini-3.1-pro": DEFAULT_GEMINI_PRO_MODEL,
        "gemini-3.1-pro-preview": DEFAULT_GEMINI_PRO_MODEL,
        "gemini-3-pro-preview": DEFAULT_GEMINI_PRO_MODEL,
        "gemini-pro": DEFAULT_GEMINI_PRO_MODEL,
        "gemini-3.5-flash": DEFAULT_GEMINI_FLASH_MODEL,
        "gemini-3-flash": DEFAULT_GEMINI_FLASH_MODEL,
        "gemini-3-flash-preview": DEFAULT_GEMINI_FLASH_MODEL,
        "gemini-flash": DEFAULT_GEMINI_FLASH_MODEL,
    };

    return aliases[value] ?? value;
}

export function resolveGeminiModel(model?: string) {
    return normalizeGeminiModel(model ?? process.env.GEMINI_FLASH_MODEL ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_FLASH_MODEL);
}

export function resolveGeminiProModel(model?: string) {
    return normalizeGeminiModel(model ?? process.env.GEMINI_IMPORT_MODEL ?? process.env.GEMINI_PRO_MODEL ?? DEFAULT_GEMINI_PRO_MODEL);
}

export async function callGemini(prompt: string, options: GeminiCallOptions = {}): Promise<string | null> {
    const client = getGeminiClient();
    if (!client) {
        console.error("Aborting Gemini call: missing API key.");
        return null;
    }

    const model = resolveGeminiModel(options.model);

    try {
        console.log(`Calling Gemini with model: ${model}`);
        const response = await client.models.generateContent({
            model,
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }],
                },
            ],
            config: {
                responseMimeType: options.responseMimeType ?? "application/json",
            },
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("Gemini response:", text ? "Success" : "Empty");
        return text ?? null;
    } catch (error: unknown) {
        const name = error instanceof Error ? error.name : "UnknownError";
        const message = error instanceof Error ? error.message : String(error);
        console.error("Gemini API call failed.");
        console.error("Error Name:", name);
        console.error("Error Message:", message);

        if (message.includes("429") || message.includes("quota")) {
            console.error("Quota exceeded: you are sending too many requests to Gemini.");
        }

        if (error instanceof Error && error.stack) console.error("Stack:", error.stack);
        return null;
    }
}
