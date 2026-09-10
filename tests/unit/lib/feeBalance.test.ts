import { describe, expect, it } from "vitest";
import { allocateCollection, remainingFee } from "@/lib/feeBalance";
import { deriveWhatsAppManualCollectionContent } from "@/services/whatsappMessage.service";
describe("Collection allocation and reminders", () => {
    it("keeps whole-rupee fees separate from money and waivers", () => {
        expect(remainingFee({ amount: 1200, status: "DUE", collectedAmount: 700 })).toBe(500);
        expect(remainingFee({ amount: 1200, status: "WAIVED", collectedAmount: 700, waivedAmount: 500 })).toBe(0);
        expect(allocateCollection([{ id: "a", dueDate: "2026-01-01", amount: 1200, collectedAmount: 700 }],500)[0].remaining).toBe(0);
    });
    it("renders the actual remaining amount in manual reminders", () => {
        const result = deriveWhatsAppManualCollectionContent({ payments: [{ id: "fee", amount: 1200, collectedAmount: 700,
            dueDate: new Date("2026-01-01"), student: { id: "student", name: "Student" } }], language: "en_IN", tone: "polite", branchName: "Library", timeZone: "Asia/Kolkata", at: new Date("2026-01-10") });
        expect(JSON.stringify(result)).toContain("500"); expect(JSON.stringify(result)).not.toContain("1,200");
    });
});
