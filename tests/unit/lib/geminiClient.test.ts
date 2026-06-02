import { afterEach, describe, expect, it } from "vitest";
import {
    DEFAULT_GEMINI_FLASH_MODEL,
    DEFAULT_GEMINI_PRO_MODEL,
    resolveGeminiModel,
    resolveGeminiProModel,
} from "@/ai/llm/gemini.client";

const originalEnv = { ...process.env };

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
        process.env.GEMINI_IMPORT_MODEL = "gemini-3.1-pro-preview";

        expect(resolveGeminiProModel()).toBe("gemini-3-pro-preview");
    });
});
