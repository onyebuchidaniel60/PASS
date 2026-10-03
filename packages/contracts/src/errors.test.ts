import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MESSAGES,
  ERROR_CODES,
  ERROR_STATUS,
  isErrorCode,
} from "./errors.js";

/**
 * D-018.8: docs/API_CONTRACTS.md §14 is the authoritative error-code list.
 * This test reads the spec directly so a code cannot be added on one side
 * without the other.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(HERE, "..", "..", "..", "docs", "API_CONTRACTS.md");

function specCodes(): string[] {
  const md = readFileSync(SPEC_PATH, "utf8");
  const section = md.split("## 14. Stable error codes")[1] ?? "";
  const block = section.split("```")[1] ?? "";
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[A-Z_]+$/.test(l));
}

describe("error codes are pinned to docs/API_CONTRACTS.md §14", () => {
  const spec = specCodes();

  it("finds the §14 block", () => {
    expect(spec.length).toBeGreaterThan(10);
  });

  it("exports exactly the codes listed in §14", () => {
    expect([...ERROR_CODES].sort()).toEqual([...spec].sort());
  });

  it("defines a message and status for every code", () => {
    for (const code of ERROR_CODES) {
      expect(DEFAULT_MESSAGES[code]).toBeTruthy();
      expect(ERROR_STATUS[code]).toBeGreaterThanOrEqual(200);
      expect(ERROR_STATUS[code]).toBeLessThan(600);
    }
  });

  it("rejects a code that is not in §14", () => {
    expect(isErrorCode("NOT_A_REAL_CODE")).toBe(false);
    expect(isErrorCode("PASS_EXPIRED")).toBe(true);
  });

  it("does not invent codes outside §14", () => {
    const notInSpec = ["MARKET_UNAVAILABLE", "RATE_LIMITED", "BAD_REQUEST", "TRUST_SCORE"];
    for (const c of notInSpec) {
      expect(ERROR_CODES).not.toContain(c);
    }
  });
});