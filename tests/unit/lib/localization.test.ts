import { describe, expect, it, vi } from "vitest";
import { messages, translate, translateError, translateOwnedText } from "@/lib/i18n";
import { INTERFACE_LANGUAGES, LANGUAGE_TAGS, normalizeLanguage } from "@/lib/i18n/language";
import { receiptSummary } from "@/lib/feeReceiptPdf";
import type { FeeCollectionView } from "@/lib/feeCollections";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));
import { UserService } from "@/services/user.service";
import { prisma } from "@/lib/prisma";

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
describe("localization contract", () => {
    it("has both translations with the same named parameters for every catalog entry", () => {
        for (const [key, pair] of Object.entries(messages)) {
            expect(pair, key).toHaveLength(2);
            for (const value of pair) {
                expect(value.trim().length, key).toBeGreaterThan(0);
                expect(placeholders(value), key).toEqual(placeholders(key));
            }
        }
    });
    it("keeps inserted names and braces untouched and handles dynamic messages", () => {
        expect(translate("hi", "Student: {name} ({id})", { name: "Original नाम {id}", id: "ref-123" })).toBe("छात्र: Original नाम {id} (ref-123)");
        for (const language of INTERFACE_LANGUAGES) {
            expect(translateOwnedText(language, "2 selected student(s) marked not marked")).not.toContain("{count}");
            expect(translateOwnedText(language, "new untranslated label")).toBe("new untranslated label");
            expect(() => new Intl.Segmenter(LANGUAGE_TAGS[language])).not.toThrow();
        }
        expect(normalizeLanguage("unsupported")).toBe("en");
        expect(translate("en", "{count} seat(s)", { count: 1 })).toBe("1 seat");
        expect(translate("en", "{count} seat(s)", { count: 2 })).toBe("2 seats");
    });
    it("does not expose arbitrary provider exceptions or change their classification", () => {
        const error = new Error("provider secret or raw request content");
        for (const language of INTERFACE_LANGUAGES) {
            expect(translateError(language, error)).toBe(translate(language, "Something went wrong. Try again."));
            expect(translateError(language, "Name is required.")).not.toContain("{field}");
        }
        expect(error.message).toBe("provider secret or raw request content");
    });
    it("validates profile choices and updates only the authenticated user's requested field", async () => {
        for (const language of INTERFACE_LANGUAGES) {
            expect(UserService.parseSettingsPayload({ interfaceLanguage: language })).toEqual({ interfaceLanguage: language });
            expect(UserService.parseSettingsPayload({ documentLanguage: language })).toEqual({ documentLanguage: language });
        }
        for (const value of ["HI", "hi-IN", "fr", null, 4]) expect(() => UserService.parseSettingsPayload({ interfaceLanguage: value })).toThrow();
        expect(UserService.parseSettingsPayload({ defaultMessageLanguage: "hi" })).toEqual({ defaultMessageLanguage: "hi" });
        expect(() => UserService.parseSettingsPayload({ userId: "other", interfaceLanguage: "hi" })).toThrow();
        await UserService.updateSettings("authenticated-user", { interfaceLanguage: "hi" });
        expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "authenticated-user" }, data: { interfaceLanguage: "hi" } });
    });
    it("renders immutable receipt facts and VOID in each document language", () => {
        const receipt: FeeCollectionView = {
            id: "collection", receiptNumber: "LL-ORIGINAL-42", amount: 700, method: "CASH", reference: "REF-Original",
            collectedAt: "2026-08-10T06:30:00.000Z", voidedAt: "2026-08-11T06:30:00.000Z", voidReason: "Original कारण",
            snapshot: { version: 1, studentId: "student-original", studentName: "Original नाम", branchName: "Original Branch", organizationName: "Original Organization", address: "Original Address", contactPhone: "9999999999", recordedBy: "Original Staff", recordedById: "staff-original", collectedAt: "2026-08-10T06:30:00.000Z", amount: 700, method: "CASH", reference: "REF-Original", note: "Original नोट {amount}", remainingBalance: 500, allocations: [{ paymentId: "payment-original", type: "MONTHLY", periodStart: "2026-07-10T00:00:00.000Z", periodEnd: "2026-08-10T00:00:00.000Z", amount: 700, remaining: 500 }] },
        };
        const before = structuredClone(receipt);
        const summaries = INTERFACE_LANGUAGES.map(language => receiptSummary(receipt, language));
        for (const summary of summaries) for (const fact of ["LL-ORIGINAL-42", "Original नाम", "Original Branch", "Original Organization", "Original Staff", "REF-Original", "Original नोट {amount}", "Original कारण", "700", "500", "VOID"]) expect(summary).toContain(fact);
        expect(new Set(summaries).size).toBe(3);
        expect(receipt).toEqual(before);
        expect(receiptSummary(receipt)).toBe(summaries[0]);
    });
});
