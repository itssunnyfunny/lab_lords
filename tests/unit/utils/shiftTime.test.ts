import { describe, it, expect } from "vitest";
import { timesOverlap, parseTime, parseNullableTime } from "@/utils/shiftTime";

/**
 * UNIT TESTS: shiftTime utility
 *
 * These are PURE FUNCTION tests — no database, no mocks needed.
 * They run in milliseconds and should never fail due to environment issues.
 *
 * Critical because: ALL conflict detection in the entire app depends on timesOverlap()
 * If this function has a bug, seats get double-booked silently.
 */

describe("parseTime", () => {
  it("converts HH:MM string to minutes since midnight", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("06:00")).toBe(360);
    expect(parseTime("12:30")).toBe(750);
    expect(parseTime("23:59")).toBe(1439);
  });
});

describe("parseNullableTime", () => {
  it("returns null for null input", () => expect(parseNullableTime(null)).toBeNull());
  it("returns null for empty string", () => expect(parseNullableTime("")).toBeNull());
  it("returns null for undefined", () => expect(parseNullableTime(undefined)).toBeNull());
  it("parses valid time string", () => expect(parseNullableTime("08:00")).toBe(480));
});

describe("timesOverlap", () => {
  // ─── Standard overlaps ───────────────────────────────────────────────────
  it("returns true for standard overlap (06:00-12:00 vs 08:00-14:00)", () => {
    expect(timesOverlap(360, 720, 480, 840)).toBe(true);
  });

  it("returns true when one shift fully contains the other", () => {
    // Morning 06:00-18:00 contains Afternoon 09:00-12:00
    expect(timesOverlap(360, 1080, 540, 720)).toBe(true);
  });

  // ─── Non-overlaps ─────────────────────────────────────────────────────────
  it("returns false for non-overlapping shifts (06:00-12:00 vs 12:00-17:00)", () => {
    // Adjacent — boundary exactly touching is NOT an overlap
    expect(timesOverlap(360, 720, 720, 1020)).toBe(false);
  });

  it("returns false for completely separate shifts (06:00-12:00 vs 14:00-18:00)", () => {
    expect(timesOverlap(360, 720, 840, 1080)).toBe(false);
  });

  // ─── Null (Full Day) ──────────────────────────────────────────────────────
  it("null start/end = full day, overlaps with everything", () => {
    // Full day vs Morning — must overlap
    expect(timesOverlap(null, null, 360, 720)).toBe(true);
  });

  it("full day overlaps with another full day", () => {
    expect(timesOverlap(null, null, null, null)).toBe(true);
  });

  it("full day overlaps with midnight-crossing shift", () => {
    expect(timesOverlap(null, null, 1320, 360)).toBe(true); // 22:00-06:00
  });

  // ─── Midnight-crossing shifts ─────────────────────────────────────────────
  it("midnight-crossing shift (22:00-06:00) overlaps with early morning (04:00-10:00)", () => {
    // 22:00 = 1320 min, 06:00 = 360 min
    // 04:00 = 240 min, 10:00 = 600 min
    expect(timesOverlap(1320, 360, 240, 600)).toBe(true);
  });

  it("midnight-crossing shift (22:00-06:00) does NOT overlap with afternoon (12:00-17:00)", () => {
    expect(timesOverlap(1320, 360, 720, 1020)).toBe(false);
  });

  it("midnight-crossing shift overlaps with another midnight-crossing shift", () => {
    // 22:00-06:00 vs 23:00-04:00
    expect(timesOverlap(1320, 360, 1380, 240)).toBe(true);
  });
});
