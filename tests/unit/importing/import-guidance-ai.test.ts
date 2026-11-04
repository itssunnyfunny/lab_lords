import { afterEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGeminiJson: provider.call, resolveGeminiProModel: () => "fixture" }));
import { mapImportColumns } from "@/importing/ai/import-column-mapper.ai";
describe("bounded guided AI preparation", () => {
    afterEach(() => vi.useRealTimers());
    it("times out without replacing deterministic mappings or allowing a late publication", async () => {
        vi.useFakeTimers();
        provider.call.mockImplementation(() => new Promise(() => {}));
        const pending = mapImportColumns({ branchContext: {}, columns: ["Name", "Unknown"], sampleRows: [{ Name: "Private student", Unknown: "secret source" }],
            draftContext: { revision: 3, answers: [{ field: "allocation.shiftName", affected: 12 }], rows: [{ rowNumber: 2, fields: ["student.name"], problems: ["MISSING_SHIFT"], manual: true }] } });
        await vi.advanceTimersByTimeAsync(15_000);
        const result = await pending;
        expect(result.usedFallback).toBe(true);
        expect(result.columnMappings[0].targetField).toBe("student.name");
        const prompt = provider.call.mock.calls[0][0] as string;
        expect(prompt).toContain('"affectedRecords":12'); expect(prompt).toContain('"manuallyCorrected":true');
        expect(prompt).not.toContain("Private student"); expect(prompt).not.toContain("secret source");
    });
});
