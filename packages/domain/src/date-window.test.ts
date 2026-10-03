import { describe, expect, it } from "vitest";
import {
  formatUtcStamp,
  isWithin,
  monthWindow,
  shiftMonth,
  windowForPeriod,
} from "./date-window.js";

describe("date windows", () => {
  const now = new Date("2026-10-03T12:00:00Z");

  it("produces half-open windows", () => {
    const w = windowForPeriod("24h", now);
    expect(isWithin(new Date("2026-10-02T12:00:00Z"), w)).toBe(true); // start inclusive
    expect(isWithin(new Date("2026-10-02T11:59:59Z"), w)).toBe(false);
    expect(isWithin(new Date("2026-10-03T11:59:59Z"), w)).toBe(true);
    expect(isWithin(new Date("2026-10-03T12:00:00Z"), w)).toBe(false); // end exclusive
  });

  it("keeps the default window live relative to now", () => {
    const later = new Date("2026-10-04T12:00:00Z");
    expect(windowForPeriod("7d", later).end.toISOString()).toBe("2026-10-04T12:00:00.000Z");
  });

  it("builds a UTC calendar month", () => {
    const w = monthWindow(2026, 9); // October 2026
    expect(w.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("clamps month stepping instead of rolling forward", () => {
    // Jan 31 + 1 month must land in February, not March.
    expect(shiftMonth(2026, 0, 1)).toEqual({ year: 2026, monthIndexZeroBased: 1 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndexZeroBased: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndexZeroBased: 11 });
  });

  it("formats a UTC stamp with the zone stated", () => {
    expect(formatUtcStamp(new Date("2026-10-03T14:22:05Z"))).toBe("2026-10-03 14:22 UTC");
  });
});