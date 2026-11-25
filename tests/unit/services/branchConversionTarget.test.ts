import { describe, expect, it } from "vitest";
import { assertDirectConversionDatabase } from "@/scripts/branch-conversion-target";

describe("conversion database target", () => {
    it.each([undefined, "", "bad-target", "prisma://example.test/test", "prisma+postgres://example.test/test",
        "https://example.test/test", "postgresql://localhost/"])("rejects an indirect or unnamed target", target => {
        expect(() => assertDirectConversionDatabase(target)).toThrow("direct PostgreSQL");
    });

    it("accepts a named direct target only when the Prisma Accelerate override is absent", () => {
        const direct = "postgresql://localhost/disposable_test";
        expect(() => assertDirectConversionDatabase(direct)).not.toThrow();
        expect(() => assertDirectConversionDatabase(direct, "prisma://example.test")).toThrow("direct PostgreSQL");
    });
});
