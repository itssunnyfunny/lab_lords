import { vi } from "vitest";
import { addMonths } from "date-fns";

/**
 * TIME CONTROL — Why This Is Critical
 *
 * The payment service uses:
 *   - new Date() to get "today"
 *   - addMonths(student.joinedAt, N) to compute due dates
 *   - isBefore(today, dueDate) to decide whether to generate
 *
 * If tests run with REAL time:
 *   - A student joined "yesterday" might not owe anything yet
 *   - Tests that pass today will FAIL next month
 *   - CI becomes randomly flaky
 *
 * Solution: freeze time to a known fixed date in every test.
 */

const BASE_DATE = new Date("2026-01-01T00:00:00.000Z");

/**
 * Freeze system time to BASE_DATE (2026-01-01).
 * Call this in beforeEach() for any test involving dates.
 * MUST call vi.useRealTimers() in afterEach() to restore.
 */
export function freezeTime(date: Date = BASE_DATE) {
  vi.useFakeTimers();
  vi.setSystemTime(date);
  return date;
}

/**
 * Advance frozen time by N months from BASE_DATE.
 * Use this to simulate "time passed" scenarios (e.g. payment generation).
 */
export function advanceMonths(n: number, from: Date = BASE_DATE) {
  const newDate = addMonths(from, n);
  vi.setSystemTime(newDate);
  return newDate;
}

/**
 * Restore real timers. Call this in afterEach().
 */
export function restoreTime() {
  vi.useRealTimers();
}
