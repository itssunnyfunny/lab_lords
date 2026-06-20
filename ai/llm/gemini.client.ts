import { GoogleGenAI } from "@google/genai";

type GeminiCallOptions = {
    model?: string;
    responseMimeType?: "application/json" | "text/plain";
    responseJsonSchema?: unknown;
};

export type GeminiJsonResult<T> =
    | { ok: true; data: T; rawText: string; error?: undefined }
    | { ok: false; data?: undefined; rawText: string | null; error: string };

export const DEFAULT_GEMINI_FLASH_MODEL = "gemini-3.5-flash";
export const DEFAULT_GEMINI_PRO_MODEL = "gemini-3.5-flash";

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
        "gemini-flash-latest": DEFAULT_GEMINI_FLASH_MODEL,
    };

    return aliases[value] ?? value;
}

export function resolveGeminiModel(model?: string) {
    return normalizeGeminiModel(model ?? process.env.GEMINI_FLASH_MODEL ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_FLASH_MODEL);
}

export function resolveGeminiProModel(model?: string) {
    return normalizeGeminiModel(model ?? process.env.GEMINI_IMPORT_MODEL ?? process.env.GEMINI_PRO_MODEL ?? DEFAULT_GEMINI_PRO_MODEL);
}

function generationConfig(options: GeminiCallOptions) {
    if (options.responseJsonSchema) {
        return {
            responseFormat: {
                text: {
                    mimeType: options.responseMimeType ?? "application/json",
                    schema: options.responseJsonSchema,
                },
            },
        };
    }

    return {
        responseMimeType: options.responseMimeType ?? "application/json",
    };
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
            config: generationConfig(options),
        });

        const text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text;
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

function cleanJson(raw: string) {
    return raw.replace(/```json/g, "").replace(/```/g, "").trim();
}

export async function callGeminiJson<T>(
    prompt: string,
    options: GeminiCallOptions = {}
): Promise<GeminiJsonResult<T>> {
    const rawText = await callGemini(prompt, {
        ...options,
        responseMimeType: "application/json",
    });

    if (!rawText) {
        return {
            ok: false,
            rawText,
            error: "Gemini returned no structured response.",
        };
    }

    try {
        return {
            ok: true,
            data: JSON.parse(cleanJson(rawText)) as T,
            rawText,
        };
    } catch (error) {
        return {
            ok: false,
            rawText,
            error: error instanceof Error ? error.message : "Gemini JSON could not be parsed.",
        };
    }
}
