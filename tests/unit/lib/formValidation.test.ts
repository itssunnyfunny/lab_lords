import { describe, expect, it } from "vitest";
import {
  parseIntegerField,
  validatePhone,
  validateSeatLabel,
  validateShiftDrafts,
} from "@/lib/formValidation";

describe("formValidation", () => {
  it("rejects negative and decimal integer fields", () => {
    expect(parseIntegerField("-1", "Monthly fee").ok).toBe(false);
    expect(parseIntegerField("10.5", "Monthly fee").ok).toBe(false);
  });

  it("keeps empty optional integer fields undefined", () => {
    const result = parseIntegerField("", "Monthly fee");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeUndefined();
  });

  it("validates phone shape and digit count", () => {
    expect(validatePhone("+91 98765 43210").ok).toBe(true);
    expect(validatePhone("abc1234567").ok).toBe(false);
    expect(validatePhone("123").ok).toBe(false);
  });

  it("rejects unsafe seat labels", () => {
    expect(validateSeatLabel("A-12").ok).toBe(true);
    expect(validateSeatLabel("#A12").ok).toBe(false);
  });

  it("normalizes shift drafts and rejects bad rows", () => {
    const valid = validateShiftDrafts([
      { name: " Morning ", startTime: "06:00", endTime: "11:59", price: "1000" },
      { name: "Evening", startTime: "17:00", endTime: "22:00", price: "" },
    ]);
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.value[0]).toMatchObject({ name: "Morning", price: 1000 });

    expect(validateShiftDrafts([{ name: "A", startTime: "99:00", endTime: "10:00" }]).ok).toBe(false);
    expect(validateShiftDrafts([
      { name: "A", startTime: "06:00", endTime: "12:00" },
      { name: "A", startTime: "13:00", endTime: "18:00" },
    ]).ok).toBe(false);
    expect(validateShiftDrafts([
      { name: "A", startTime: "06:00", endTime: "12:00" },
      { name: "B", startTime: "11:00", endTime: "18:00" },
    ]).ok).toBe(false);
  });
});

