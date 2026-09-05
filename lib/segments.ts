import type { TimeRange } from "./silenceDetector";

/** Merge overlapping/adjacent ranges, sorted by start time. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

/** Given ranges to CUT and the total duration, return the ranges to KEEP. */
export function invertToKeepRanges(
  cutRanges: TimeRange[],
  duration: number,
  minKeepMs = 30
): TimeRange[] {
  const merged = mergeRanges(cutRanges);
  const keep: TimeRange[] = [];
  let cursor = 0;

  for (const cut of merged) {
    if (cut.start > cursor) {
      keep.push({ start: cursor, end: Math.min(cut.start, duration) });
    }
    cursor = Math.max(cursor, cut.end);
  }
  if (cursor < duration) {
    keep.push({ start: cursor, end: duration });
  }

  return keep.filter((r) => (r.end - r.start) * 1000 >= minKeepMs);
}

export function totalCutSeconds(cutRanges: TimeRange[]): number {
  return mergeRanges(cutRanges).reduce((sum, r) => sum + (r.end - r.start), 0);
}
