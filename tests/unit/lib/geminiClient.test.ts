import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    callGeminiJson,
    DEFAULT_GEMINI_FLASH_MODEL,
    DEFAULT_GEMINI_PRO_MODEL,
    resolveGeminiModel,
    resolveGeminiProModel,
} from "@/ai/llm/gemini.client";

const mocks = vi.hoisted(() => ({
    generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
    GoogleGenAI: vi.fn(function GoogleGenAIMock() {
        return {
            models: {
                generateContent: mocks.generateContent,
            },
        };
    }),
}));

const originalEnv = { ...process.env };

beforeEach(() => {
    mocks.generateContent.mockReset();
});

afterEach(() => {
    process.env = { ...originalEnv };
});

describe("Gemini model resolution", () => {
    it("uses current Flash and Pro defaults", () => {
        delete process.env.GEMINI_MODEL;
        delete process.env.GEMINI_FLASH_MODEL;
        delete process.env.GEMINI_PRO_MODEL;
        delete process.env.GEMINI_IMPORT_MODEL;

        expect(resolveGeminiModel()).toBe(DEFAULT_GEMINI_FLASH_MODEL);
        expect(resolveGeminiProModel()).toBe(DEFAULT_GEMINI_PRO_MODEL);
    });

    it("normalizes stale Gemini aliases from environment overrides", () => {
        process.env.GEMINI_MODEL = "gemini-3-flash";
        process.env.GEMINI_PRO_MODEL = "gemini-3.1-pro";

        expect(resolveGeminiModel()).toBe(DEFAULT_GEMINI_FLASH_MODEL);
        expect(resolveGeminiProModel()).toBe(DEFAULT_GEMINI_PRO_MODEL);
    });

    it("lets import analysis use a dedicated Pro override", () => {
        process.env.GEMINI_PRO_MODEL = "gemini-pro";
        process.env.GEMINI_IMPORT_MODEL = "gemini-2.5-pro";

        expect(resolveGeminiProModel()).toBe("gemini-2.5-pro");
    });
});

describe("Gemini structured JSON calls", () => {
    it("returns a clear failure when the API key is missing", async () => {
        delete process.env.GEMINI_API_KEY;

        const result = await callGeminiJson<{ value: number }>("Return JSON");

        expect(result.ok).toBe(false);
        expect(result.rawText).toBeNull();
        expect(result.error).toContain("no structured response");
        expect(mocks.generateContent).not.toHaveBeenCalled();
    });

    it("uses the current structured-output config shape", async () => {
        process.env.GEMINI_API_KEY = "test-key";
        const schema = { type: "object", properties: { value: { type: "number" } }, required: ["value"] };
        mocks.generateContent.mockResolvedValueOnce({ text: "{\"value\":1}" });

        const result = await callGeminiJson<{ value: number }>("Return JSON", {
            model: "gemini-3.5-flash",
            responseJsonSchema: schema,
        });

        expect(result).toEqual({ ok: true, data: { value: 1 }, rawText: "{\"value\":1}" });
        expect(mocks.generateContent).toHaveBeenCalledWith(expect.objectContaining({
            model: "gemini-3.5-flash",
            config: {
                responseFormat: {
                    text: {
                        mimeType: "application/json",
                        schema,
                    },
                },
            },
        }));
    });

    it("returns parse errors with the raw Gemini text", async () => {
        process.env.GEMINI_API_KEY = "test-key";
        mocks.generateContent.mockResolvedValueOnce({ text: "not json" });

        const result = await callGeminiJson("Return JSON");

        expect(result.ok).toBe(false);
        expect(result.rawText).toBe("not json");
    });
});
