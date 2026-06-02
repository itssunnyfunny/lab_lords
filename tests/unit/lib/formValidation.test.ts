import { describe, expect, it } from "vitest";
import {
  parseIntegerField,
  validateOptionalId,
  validatePhone,
  validateRequiredPhone,
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

  it("rejects non-text optional IDs and non-numeric integer payloads", () => {
    expect(validateOptionalId(123, "Linked shift").ok).toBe(false);
    expect(validateOptionalId({ id: "shift_1" }, "Linked shift").ok).toBe(false);
    expect(validateOptionalId("shift_1", "Linked shift").ok).toBe(true);
    expect(parseIntegerField(false, "Monthly fee").ok).toBe(false);
    expect(parseIntegerField({ amount: 1000 }, "Monthly fee").ok).toBe(false);
  });

  it("normalizes supported Indian mobile phone formats", () => {
    const values = ["9876543210", "09876543210", "919876543210", "+91 98765 43210"];

    for (const value of values) {
      const result = validatePhone(value);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe("+91 98765 43210");
    }
  });

  it("rejects invalid Indian mobile phone formats", () => {
    expect(validatePhone(9876543210).ok).toBe(false);
    expect(validatePhone("abc1234567").ok).toBe(false);
    expect(validatePhone("123").ok).toBe(false);
    expect(validatePhone("+1 98765 43210").ok).toBe(false);
    expect(validatePhone("+91 58765 43210").ok).toBe(false);
    expect(validatePhone("98765+43210").ok).toBe(false);
    expect(validatePhone("98765-43210").ok).toBe(false);
    expect(validatePhone("+91 (98765) 43210").ok).toBe(false);
  });

  it("requires phone when requested", () => {
    expect(validatePhone("").ok).toBe(true);
    expect(validateRequiredPhone("").ok).toBe(false);
    const result = validateRequiredPhone("9876543210");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe("+91 98765 43210");
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
    expect(validateShiftDrafts([
      { name: "Morning", startTime: "06:00", endTime: "09:59" },
      { name: "Full Time", startTime: "06:00", endTime: "21:59" },
    ]).ok).toBe(false);
  });
});
