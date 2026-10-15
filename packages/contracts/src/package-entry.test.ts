import { describe, expect, it } from "vitest";

// Resolved through the package entry (exports -> ./src/index.ts with
// NodeNext `.js` specifiers), not a relative path: this is the import shape
// the web app bundles via webpack, so it guards the exact resolution that
// broke the Vercel build.
import { MAX_LEVERAGE, MIN_ORDER_VALUE_USD } from "@pass/contracts";

describe("@pass/contracts package entry", () => {
  it("exposes the shared limits at runtime", () => {
    expect(MAX_LEVERAGE).toBe(10);
    expect(MIN_ORDER_VALUE_USD).toBe(10);
  });
});
