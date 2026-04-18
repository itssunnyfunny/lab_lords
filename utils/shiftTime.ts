/**
 * Shared utility for all shift-time overlap calculations.
 *
 * Rules:
 *  - A shift with null start/end time is treated as spanning the FULL 24-hour day
 *    (i.e. it overlaps with EVERYTHING). This prevents the "null-time bypass" bug.
 *  - Midnight-crossing shifts (e.g. 22:00–06:00) are handled correctly by
 *    splitting them into two segments and checking each.
 */

const FULL_DAY_START = 0;
const FULL_DAY_END = 1440; // 24 * 60

/** Converts "HH:MM" to integer minutes since midnight. */
export function parseTime(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

/**
 * Returns true if two time windows overlap.
 *
 * Handles:
 *  1. Normal windows (start < end): uses standard interval overlap.
 *  2. Midnight-crossing windows (start > end, e.g. 22:00–06:00): split into
 *     [start, 1440] + [0, end] and check against the other window's segments.
 *  3. Null times: treated as [0, 1440] (full day), overlapping with everything.
 *
 * Adjacency (e.g. 12:00==12:00 boundary) is NOT considered an overlap.
 */
export function timesOverlap(
    aStart: number | null,
    aEnd: number | null,
    bStart: number | null,
    bEnd: number | null
): boolean {
    // Null means "full day"
    const as = aStart ?? FULL_DAY_START;
    const ae = aEnd ?? FULL_DAY_END;
    const bs = bStart ?? FULL_DAY_START;
    const be = bEnd ?? FULL_DAY_END;

    // Decompose each side into one or two normal (non-crossing) segments
    const aSegments = toSegments(as, ae);
    const bSegments = toSegments(bs, be);

    for (const [a1, a2] of aSegments) {
        for (const [b1, b2] of bSegments) {
            if (normalOverlap(a1, a2, b1, b2)) return true;
        }
    }
    return false;
}

/** Standard non-crossing overlap: a1 < b2 && a2 > b1 */
function normalOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
    return a1 < b2 && a2 > b1;
}

/**
 * Converts a time window into one or two non-crossing segments.
 * If start < end → [[start, end]]
 * If start > end (midnight crossing) → [[start, 1440], [0, end]]
 * If start === end → treat as full day [[0, 1440]]
 */
function toSegments(start: number, end: number): [number, number][] {
    if (start === end) return [[FULL_DAY_START, FULL_DAY_END]];
    if (start < end) return [[start, end]];
    // Midnight crossing
    return [[start, FULL_DAY_END], [FULL_DAY_START, end]];
}

/**
 * Helper: parse nullable time strings into nullable numbers.
 * Returns null if the time string is null/undefined/empty.
 */
export function parseNullableTime(time: string | null | undefined): number | null {
    if (!time) return null;
    return parseTime(time);
}
