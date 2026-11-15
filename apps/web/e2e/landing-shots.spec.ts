import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";

/**
 * Marketing/application split shots.
 *
 * Run against a local server:
 *
 *   pnpm --filter @pass/web start
 *   pnpm --filter @pass/web exec playwright test e2e/landing-shots.spec.ts
 *
 * `/` is the public marketing page with its own minimal header; `/app` is the
 * original application homepage with the global topbar and footer.
 */
const SHOTS: Array<[name: string, route: string]> = [
  ["marketing", "/"],
  ["app-home", "/app"],
];

test("marketing and app-home full-page shots", async ({ page }, testInfo) => {
  const outDir = resolve(
    process.cwd(),
    "..",
    "..",
    "design",
    "verify",
    "screenshots",
    "routing-separation",
  );
  mkdirSync(outDir, { recursive: true });

  for (const [name, route] of SHOTS) {
    await page.goto(route, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    // Wait for the self-hosted faces to paint before capturing type.
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: join(outDir, `${name}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
});
