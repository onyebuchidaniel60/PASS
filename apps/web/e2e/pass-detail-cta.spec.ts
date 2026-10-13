import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";

/**
 * Pass-detail CTA session shots + CTA position measurement.
 * SHOT_MODE=before|after. BASE via E2E_BASE_URL (default localhost).
 * A live takable pass is needed: pass PUBLIC_ID explicitly or default it.
 */
const PASS = process.env.SHOT_PASS ?? "MgenhZMcSg";
const WIDTHS = [375, 1280];

test("pass-detail-cta shots", async ({ page }, testInfo) => {
  const mode = process.env.SHOT_MODE ?? "before";
  const outDir = resolve(process.cwd(), "..", "..", "design", "verify", "screenshots", "pass-detail-cta");
  mkdirSync(outDir, { recursive: true });
  const routes: Array<[string, string]> = [
    ["discover", "/discover"],
    ["pass-detail", `/p/${PASS}`],
    ["take-step1", `/passes/${PASS}/take`],
  ];
  for (const [name, route] of routes) {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(route, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      if (name === "pass-detail") {
        // Measured, not eyeballed: is a Take Pass CTA inside the viewport?
        const boxes = await page
          .getByRole("link", { name: "Take Pass" })
          .evaluateAll((els) =>
            els.map((e) => {
              const r = e.getBoundingClientRect();
              return { y: Math.round(r.top), h: Math.round(r.height) };
            }),
          )
          .catch(() => []);
        const vh = await page.evaluate(() => window.innerHeight);
        console.log(`CTA-MEASURE ${name} w=${w} vh=${vh} boxes=${JSON.stringify(boxes)}`);
      }
      await page.screenshot({
        path: join(outDir, `${name}-${w}-${mode}-${testInfo.project.name}.png`),
        fullPage: true,
      });
    }
  }
});
