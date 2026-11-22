import { dashboardDateOffset, dashboardDayStart, dashboardToday } from "@/lib/dashboardMath";

export const MAX_TREND_POINTS = 31;
export class TrendRangeError extends Error {}

export function assertTrendRange(from: Date, to: Date, timezone?: string) {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
    throw new TrendRangeError("Invalid trend date range");
  }
  if (timezone) {
    const firstExcludedDay = dashboardDateOffset(dashboardToday(from, timezone), MAX_TREND_POINTS);
    if (dashboardToday(to, timezone) >= firstExcludedDay) throw new TrendRangeError("Trend ranges support at most 31 daily points");
    return;
  }
  // Match the daily cursor used by the trend helpers, including local DST.
  const limit = new Date(from);
  limit.setDate(limit.getDate() + MAX_TREND_POINTS);
  if (to >= limit) throw new TrendRangeError("Trend ranges support at most 31 daily points");
}

export function parseTrendDate(value: string, timezone?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) throw new TrendRangeError("Invalid date format");
  const [, year, month, day] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(calendar.getTime())
    || calendar.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
    || value.includes("T24:")) throw new TrendRangeError("Invalid date format");
  return timezone && value.length === 10 ? dashboardDayStart(value, timezone) : date;
}
