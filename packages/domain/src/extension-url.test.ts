import { describe, expect, it } from "vitest";

/**
 * URL-based handle detection rules.
 *
 * The handle is read from the URL, never scraped from the DOM, so these rules
 * are the whole contract (docs/EXTENSION_SPEC.md §7, §8).
 */

// Mirrors getHandleFromUrl in src/content.ts. It is duplicated rather than
// imported because content.ts touches chrome.* and window at module scope,
// which is unavailable in a node test environment.
const RESERVED = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "settings",
  "compose",
  "search",
  "i",
  "intent",
  "about",
  "privacy",
  "tos",
  "hashtag",
  "search-topic",
]);

function getHandleFromUrl(pathname: string): string | null {
  const raw = pathname ?? "/";
  const path = raw.split(/[?#]/)[0] ?? "/";
  const segments = path.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) return null;
  const lowered = first.toLowerCase();
  if (RESERVED.has(lowered)) return null;
  if (/^[0-9]+$/.test(lowered)) return null;
  return lowered;
}

describe("getHandleFromUrl", () => {
  it("reads a profile handle from the first path segment", () => {
    expect(getHandleFromUrl("/turnttfup99")).toBe("turnttfup99");
  });

  it("keeps the handle on sub-routes of a profile", () => {
    expect(getHandleFromUrl("/turnttfup99/status/123")).toBe("turnttfup99");
    expect(getHandleFromUrl("/turnttfup99/with_replies")).toBe("turnttfup99");
    expect(getHandleFromUrl("/turnttfup99/media")).toBe("turnttfup99");
  });

  it("lower-cases the handle", () => {
    expect(getHandleFromUrl("/TurnTTFup99")).toBe("turnttfup99");
  });

  it("returns null for reserved routes", () => {
    for (const path of [
      "/home",
      "/explore",
      "/notifications",
      "/messages",
      "/settings",
      "/compose",
      "/compose/post",
      "/search",
      "/i",
      "/i/lists/123",
      "/intent",
      "/intent/post",
      "/about",
      "/privacy",
      "/tos",
      "/hashtag/crypto",
    ]) {
      expect(getHandleFromUrl(path), path).toBeNull();
    }
  });

  it("returns null for empty or root paths", () => {
    expect(getHandleFromUrl("/")).toBeNull();
    expect(getHandleFromUrl("")).toBeNull();
  });

  it("returns null for numeric ids", () => {
    expect(getHandleFromUrl("/1234567")).toBeNull();
  });

  it("never lets a query string or hash become part of a handle", () => {
    expect(getHandleFromUrl("/search?q=crypto")).toBeNull();
    expect(getHandleFromUrl("/home#compose")).toBeNull();
    expect(getHandleFromUrl("/turnttfup99?ref=abc")).toBe("turnttfup99");
  });
});