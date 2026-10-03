import { describe, expect, it } from "vitest";
import { isTerminal, type PassStatus } from "@pass/contracts";
import {
  acceptsExecution,
  allowedTransitions,
  canTransition,
  isStaleVersion,
} from "./pass-lifecycle.js";

/** docs/PRODUCT_PRD.md §10 */
describe("Pass lifecycle state machine", () => {
  it("follows the documented path draft -> active -> entry_pending -> open", () => {
    expect(canTransition("draft", "active")).toBe(true);
    expect(canTransition("active", "entry_pending")).toBe(true);
    expect(canTransition("entry_pending", "open")).toBe(true);
  });

  it("allows the documented branches out of active", () => {
    expect(allowedTransitions("active")).toEqual(
      expect.arrayContaining(["expired", "cancelled", "invalidated"]),
    );
  });

  it("allows close states out of open", () => {
    expect(canTransition("open", "tp_hit")).toBe(true);
    expect(canTransition("open", "sl_hit")).toBe(true);
    expect(canTransition("open", "manually_closed")).toBe(true);
  });

  it("never leaves a terminal state (docs/DATA_MODEL.md §3.8)", () => {
    const terminals: PassStatus[] = ["tp_hit", "sl_hit", "manually_closed", "expired", "cancelled", "invalidated"];
    for (const s of terminals) {
      expect(isTerminal(s)).toBe(true);
      expect(allowedTransitions(s)).toHaveLength(0);
    }
  });

  it("refuses to skip publication", () => {
    expect(canTransition("draft", "open")).toBe(false);
    expect(canTransition("draft", "entry_pending")).toBe(false);
  });

  it("only active and entry_pending accept a new execution", () => {
    expect(acceptsExecution("active")).toBe(true);
    expect(acceptsExecution("entry_pending")).toBe(true);
    const notTakable: PassStatus[] = ["draft", "open", "cancelled", "expired", "tp_hit", "sl_hit", "invalidated", "manually_closed"];
    for (const s of notTakable) {
      expect(acceptsExecution(s)).toBe(false);
    }
  });
});

/** docs/UX_SPEC.md §9, D-018.3 step 3 */
describe("stale version detection", () => {
  it("treats a matching version as current", () => {
    expect(isStaleVersion(3, 3)).toBe(false);
  });

  it("treats an older reviewed version as stale", () => {
    expect(isStaleVersion(2, 3)).toBe(true);
  });

  it("treats a newer reviewed version as stale", () => {
    expect(isStaleVersion(4, 3)).toBe(true);
  });

  it("honours an explicitly allowed prior version", () => {
    expect(isStaleVersion(2, 3, [2])).toBe(false);
  });
});