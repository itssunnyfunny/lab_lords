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

  it("uses calendar days for the seven-day overdue grace period", () => {
    expect(daysPastDue(new Date(2026, 4, 2, 23, 59), asOf)).toBe(7);
    expect(isOverdue(new Date(2026, 4, 2), asOf)).toBe(false);
    expect(isOverdue(new Date(2026, 4, 1, 23, 59), asOf)).toBe(true);
  });

  it("returns the first non-overdue day as the query cutoff", () => {
    const cutoff = overdueCutoff(asOf);

    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(4);
    expect(cutoff.getDate()).toBe(2);
    expect(cutoff.getHours()).toBe(0);
    expect(cutoff.getMinutes()).toBe(0);
    expect(cutoff.getSeconds()).toBe(0);
    expect(cutoff.getMilliseconds()).toBe(0);
  });
});
