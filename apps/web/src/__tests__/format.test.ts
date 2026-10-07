import { describe, expect, it } from "vitest";

import { formatRelative, relative } from "@/lib/format";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const at = (iso: string) => iso;

describe("formatRelative", () => {
  it("renders a recent past timestamp as just now", () => {
    // Inside the one-minute window. Exactly 60s ago is the boundary and reads
    // "1m ago", so this fixture stays deliberately clear of it.
    expect(formatRelative(at("2026-10-06T11:59:30.000Z"), NOW)).toBe("just now");
    expect(formatRelative(at("2026-10-06T12:00:00.000Z"), NOW)).toBe("just now");
  });

  it("renders minutes, hours and days in the past", () => {
    expect(formatRelative(at("2026-10-06T11:30:00.000Z"), NOW)).toBe("30m ago");
    expect(formatRelative(at("2026-10-06T09:00:00.000Z"), NOW)).toBe("3h ago");
    expect(formatRelative(at("2026-10-01T12:00:00.000Z"), NOW)).toBe("5d ago");
  });

  // The regression this change exists to prevent.
  it("NEVER renders a future timestamp as just now", () => {
    expect(formatRelative(at("2026-10-06T12:30:00.000Z"), NOW)).toBe("in 30m");
    expect(formatRelative(at("2026-10-06T15:00:00.000Z"), NOW)).toBe("in 3h");
    expect(formatRelative(at("2026-10-09T12:00:00.000Z"), NOW)).toBe("in 3d");
  });

  it("renders an expiry a week out as a distance forward", () => {
    const out = formatRelative(at("2026-10-13T12:00:00.000Z"), NOW);
    expect(out).toBe("in 7d");
    // The old bug emitted "just now" here, via a negative hour count.
    expect(out).not.toBe("just now");
  });

  it("carries no ago suffix in the future direction", () => {
    for (const iso of [
      "2026-10-06T12:01:00.000Z",
      "2026-10-06T18:00:00.000Z",
      "2026-10-20T12:00:00.000Z",
      "2027-10-06T12:00:00.000Z",
    ]) {
      expect(formatRelative(iso, NOW)).not.toContain("ago");
    }
  });

  it("renders the exact present as just now", () => {
    expect(formatRelative(NOW, NOW)).toBe("just now");
  });

  it("accepts Date objects and empty input", () => {
    expect(formatRelative(new Date("2026-10-06T09:00:00.000Z"), NOW)).toBe("3h ago");
    expect(formatRelative(null, NOW)).toBe("");
    expect(formatRelative("", NOW)).toBe("");
    expect(formatRelative("not a date", NOW)).toBe("");
  });

  it("keeps the legacy export name working", () => {
    expect(relative(at("2026-10-06T12:30:00.000Z"), NOW)).toBe("in 30m");
  });
});