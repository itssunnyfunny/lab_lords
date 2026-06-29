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
const DEFAULT_GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

let genAI: GoogleGenAI | null = null;
let genAIKey: string | null = null;
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

    if (!genAI || genAIKey !== apiKey) {
        genAI = new GoogleGenAI({ apiKey });
        genAIKey = apiKey;
    }
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

function uniqueModels(models: string[]) {
    return [...new Set(models.map(normalizeGeminiModel).filter(Boolean))];
}

function fallbackModels(primaryModel: string) {
    const configuredFallbacks = process.env.GEMINI_FALLBACK_MODELS?.split(",") ?? [];
    return uniqueModels([...configuredFallbacks, ...DEFAULT_GEMINI_FALLBACK_MODELS])
        .filter((model) => model !== primaryModel);
}

function shouldRetryWithFallback(message: string) {
    return /503|UNAVAILABLE|high demand|temporar/i.test(message);
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
            responseMimeType: options.responseMimeType ?? "application/json",
            responseJsonSchema: options.responseJsonSchema,
        };
    }

    return {
        responseMimeType: options.responseMimeType ?? "application/json",
    };
}

function extractGeminiText(response: unknown) {
    if (!response || typeof response !== "object") {
        return null;
    }

    const maybeText = (response as { text?: unknown }).text;
    if (typeof maybeText === "string") {
        return maybeText;
    }
    if (typeof maybeText === "function") {
        const value = maybeText.call(response);
        if (typeof value === "string") {
            return value;
        }
    }

    const candidates = (response as { candidates?: unknown }).candidates;
    if (!Array.isArray(candidates)) {
        return null;
    }

    const parts = (candidates[0] as { content?: { parts?: unknown } } | undefined)?.content?.parts;
    if (!Array.isArray(parts)) {
        return null;
    }

    const text = parts
        .map((part) => typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : "")
        .join("")
        .trim();

    return text || null;
}

type GeminiTextResult =
    | { ok: true; text: string; model: string; error?: undefined }
    | { ok: false; text: null; model: string | null; error: string };

async function generateGeminiText(prompt: string, options: GeminiCallOptions = {}): Promise<GeminiTextResult> {
    const client = getGeminiClient();
    if (!client) {
        const error = "Aborting Gemini call: missing API key.";
        console.error(error);
        return { ok: false, text: null, model: null, error };
    }

    const primaryModel = resolveGeminiModel(options.model);
    const models = [primaryModel, ...fallbackModels(primaryModel)];
    let lastError = "Gemini returned no text.";

    for (const model of models) {
        console.log(`Calling Gemini with model: ${model}`);

        try {
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

            const text = extractGeminiText(response);
            console.log("Gemini response:", text ? "Success" : "Empty");
            if (text) {
                return { ok: true, text, model };
            }
            lastError = `Gemini returned an empty response for model ${model}.`;
        } catch (error: unknown) {
            const name = error instanceof Error ? error.name : "UnknownError";
            const message = error instanceof Error ? error.message : String(error);
            lastError = `Gemini API call failed for ${model}: ${message}`;
            console.error("Gemini API call failed.");
            console.error("Error Name:", name);
            console.error("Error Message:", message);

            if (message.includes("429") || message.includes("quota")) {
                console.error("Quota exceeded: you are sending too many requests to Gemini.");
            }

            if (!shouldRetryWithFallback(message)) {
                break;
            }
        }
    }

    return { ok: false, text: null, model: primaryModel, error: lastError };
}

export async function callGemini(prompt: string, options: GeminiCallOptions = {}): Promise<string | null> {
    const result = await generateGeminiText(prompt, options);
    return result.ok ? result.text : null;
}

function cleanJson(raw: string) {
    return raw.replace(/```json/g, "").replace(/```/g, "").trim();
}

export async function callGeminiJson<T>(
    prompt: string,
    options: GeminiCallOptions = {}
): Promise<GeminiJsonResult<T>> {
    const result = await generateGeminiText(prompt, {
        ...options,
        responseMimeType: "application/json",
    });

    if (!result.ok) {
        return {
            ok: false,
            rawText: null,
            error: result.error,
        };
    }

    const rawText = result.text;
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
