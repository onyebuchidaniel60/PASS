import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";

/**
 * Design-review shots for the temporary `/landing-mockup` route.
 *
 * Run against a local server:
 *
 *   pnpm --filter @pass/web start
 *   pnpm --filter @pass/web exec playwright test e2e/landing-mockup-shots.spec.ts
 *
 * The output lives beside the other review artefacts so the operator can
 * compare the desktop and mobile compositions without running the app.
 */
test("landing mockup full-page shots", async ({ page }, testInfo) => {
  const outDir = resolve(
    process.cwd(),
    "..",
    "..",
    "design",
    "verify",
    "screenshots",
    "landing-mockup",
  );
  mkdirSync(outDir, { recursive: true });

  await page.goto("/landing-mockup", { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  // Wait for the self-hosted faces to paint before capturing type.
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: join(outDir, `landing-mockup-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
