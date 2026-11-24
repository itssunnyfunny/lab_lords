import { describe, expect, it } from "vitest";
import {
  daysPastDue,
  dueAsOfCutoff,
  isOverdue,
  overdueCutoff,
} from "@/lib/utils/paymentStatus";

describe("payment status date helpers", () => {
  const asOf = new Date(2026, 4, 9, 12, 30);

  it("treats due as an end-of-day concept", () => {
    const cutoff = dueAsOfCutoff(asOf);

    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(4);
    expect(cutoff.getDate()).toBe(9);
    expect(cutoff.getHours()).toBe(23);
    expect(cutoff.getMinutes()).toBe(59);
    expect(cutoff.getSeconds()).toBe(59);
    expect(cutoff.getMilliseconds()).toBe(999);
  });

  it.each([
    [3, "2026-05-13T18:29:59.999Z", "2026-05-13T18:30:00.000Z"],
    [0, "2026-05-10T18:29:59.999Z", "2026-05-10T18:30:00.000Z"],
  ])("uses %i grace days at the organization’s midnight", (paymentGraceDays, before, overdue) => {
    const policy = { paymentGraceDays, timezone: "Asia/Kolkata" };
    const due = new Date("2026-05-10T18:29:59.999Z");
    expect(isOverdue(due, policy, new Date(before))).toBe(false);
    expect(isOverdue(due, policy, new Date(overdue))).toBe(true);
    expect(due < overdueCutoff(policy, new Date(before))).toBe(false);
    expect(due < overdueCutoff(policy, new Date(overdue))).toBe(true);
    expect(daysPastDue(due, new Date(overdue), policy.timezone)).toBe(paymentGraceDays + 1);
  });
});
