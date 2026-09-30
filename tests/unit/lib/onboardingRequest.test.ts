import { describe, expect, it } from "vitest";
import { hashOnboardingRequest, normalizeOnboardingKey } from "@/lib/onboardingRequest";

const payload = {
    selectedPostTrialPlan: "BASIC" as const, ownerPhone: "+91 98765 43210",
    orgName: "Library", branchName: "Main", seatLabels: ["A1", "A2"],
    shifts: [
        { name: "Morning", startTime: "06:00", endTime: "09:59", price: 100 },
        { name: "Evening", startTime: "16:00", endTime: "21:59", price: 200 },
    ],
    multiShifts: [{ name: "Both", price: 250, componentShiftNames: ["Morning", "Evening"] }],
};
describe("onboarding request identity", () => {
    it("does not depend on object insertion order or client-only metadata", () => {
        const reordered = Object.fromEntries(Object.entries(payload).reverse()) as typeof payload;
        expect(hashOnboardingRequest(reordered)).toBe(hashOnboardingRequest(payload));
        expect(hashOnboardingRequest({ ...payload, shifts: payload.shifts.map(shift => ({ ...shift, clientId: "transient" })) })).toBe(hashOnboardingRequest(payload));
    });
    it("normalizes equivalent empty/default scalar values", () => {
        expect(hashOnboardingRequest({ ...payload, defaultFee: 0, includeFullTimeMultiShift: true }))
            .toBe(hashOnboardingRequest(payload));
    });
    it("preserves an explicit empty bundle selection versus default bundle intent", () => {
        expect(hashOnboardingRequest({ ...payload, multiShifts: [] }))
            .not.toBe(hashOnboardingRequest({ ...payload, multiShifts: undefined }));
    });
    it("preserves meaningful component ordering", () => {
        expect(hashOnboardingRequest({ ...payload, multiShifts: [{ ...payload.multiShifts[0], componentShiftNames: ["Evening", "Morning"] }] }))
            .not.toBe(hashOnboardingRequest(payload));
    });
    it.each([
        { selectedPostTrialPlan: "PRO" as const }, { ownerPhone: "+91 98765 43211" },
        { orgName: "Other" }, { businessType: "Study room" }, { branchName: "Other" },
        { city: "Delhi" }, { defaultFee: 1 }, { seatLabels: ["B1", "A2"] },
        { shifts: [{ ...payload.shifts[0], price: 101 }, payload.shifts[1]] },
        { multiShifts: [{ ...payload.multiShifts[0], price: 251 }] }, { includeFullTimeMultiShift: false },
    ])("binds each creation-affecting input", change => {
        expect(hashOnboardingRequest({ ...payload, ...change })).not.toBe(hashOnboardingRequest(payload));
    });
    it("canonicalizes UUID case without allowing a different key format", () => {
        expect(normalizeOnboardingKey("ABCDEFAB-1111-4111-8111-111111111111")).toBe("abcdefab-1111-4111-8111-111111111111");
        expect(() => normalizeOnboardingKey(" ABCDEFAB-1111-4111-8111-111111111111")).toThrow();
    });
});
