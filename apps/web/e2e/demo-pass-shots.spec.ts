import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";

/**
 * Demo-pass shot helper (visual session only).
 * SHOT_MODE=before|after, SHOT_SCREENS=comma list (default: all).
 * SHOT_AUTH=1 sets the seeded demo session cookie (local dev only) from
 * PASS_TEST_SESSION_COOKIE, which must be set in the environment — the
 * value is never stored in the repo.
 */
const COOKIE = process.env.PASS_TEST_SESSION_COOKIE ?? "";
if (process.env.SHOT_AUTH === "1" && !COOKIE) {
  throw new Error("SHOT_AUTH=1 requires PASS_TEST_SESSION_COOKIE to be set.");
}

const ALL: Array<[string, string, boolean]> = [
  ["landing", "/", false],
  ["onboarding", "/onboarding", false],
  ["create", "/passes/new", true],
  ["pass-detail", "/p/DEMOT01", false],
  ["take", "/passes/DEMOT01/take", false],
  ["executions", "/me/executions", true],
  ["trader", "/u/demotrader", false],
];

test("demo-pass shots", async ({ page }, testInfo) => {
  const mode = process.env.SHOT_MODE ?? "before";
  const authed = process.env.SHOT_AUTH === "1";
  const only = (process.env.SHOT_SCREENS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const shots = only.length ? ALL.filter(([n]) => only.includes(n)) : ALL;
  const outDir = resolve(process.cwd(), "..", "..", "design", "verify", "screenshots", "demo-pass");
  mkdirSync(outDir, { recursive: true });
  if (authed) {
    await page.context().addCookies([
      { name: "pass_session", value: COOKIE, domain: "localhost", path: "/" },
    ]);
  }
  for (const [name, route] of shots) {
    await page.goto(route, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    if (name === "take") {
      // Step 2 (preview): size + review. Step 3 (authorize) after.
      const input = page.locator("input[inputmode='decimal']");
      await input.clear().catch(() => {});
      await input.fill("1250").catch(() => {});
      await page.getByRole("button", { name: "Review order" }).click().catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: join(outDir, `take-step2-${mode}-${testInfo.project.name}.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Authorize" }).click().catch(() => {});
      await page.waitForTimeout(1200);
    }
    await page.screenshot({
      path: join(outDir, `${name}-${mode}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
});
