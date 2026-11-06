import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { GuidedPaymentProblem } from "@/app/branch/[branchId]/onboarding/import/[sessionId]/_components/GuidedPaymentProblem";
import type { ImportRow } from "@/app/branch/[branchId]/onboarding/import/[sessionId]/_components/types";
import { currentMonthOutcome } from "@/importing/utils/current-month-import";

describe("recorded payment before the eligible due", () => {
    it("explains the actual due date and a safe next action while preserving the blocking fact", () => {
        const data: ImportNormalizedRow = { student: { name: "Synthetic pending", joinedAt: "2026-01-10", monthlyFee: 1300 }, payment: { status: "PAID", amount: 1300, method: "CASH" } };
        const outcome = currentMonthOutcome(data, new Date(2026, 10, 6, 12));
        const row = { normalizedData: data, issues: outcome.issues, paymentOutcome: outcome } as ImportRow;
        const before = JSON.stringify(row);
        const html = renderToStaticMarkup(<GuidedPaymentProblem row={row} explain />);
        expect(html).toContain("Payment recorded before the due date");
        expect(html).toMatch(/10.*Nov.*2026/);
        expect(html).toContain("keep this student pending");
        expect(html).toContain("does not exclude the student or change Paid to Due");
        expect(html).toContain("No early due or advance payment will be created");
        expect(JSON.stringify(row)).toBe(before);
        expect(outcome.state).toBe("NEEDS_REVIEW");
        expect(currentMonthOutcome(data, new Date(2026, 10, 10, 12)).state).toBe("CREATE_NOW");
    });
    it("does not present an ordinary Due as an early-payment conflict", () => {
        const data: ImportNormalizedRow = { student: { joinedAt: "2026-01-10", monthlyFee: 1300 }, payment: { status: "DUE" } };
        const outcome = currentMonthOutcome(data, new Date(2026, 10, 6, 12));
        expect(renderToStaticMarkup(<GuidedPaymentProblem row={{ normalizedData: data, issues: outcome.issues, paymentOutcome: outcome } as ImportRow} explain />)).toBe("");
        expect(outcome.state).toBe("GENERATE_LATER");
    });
});
