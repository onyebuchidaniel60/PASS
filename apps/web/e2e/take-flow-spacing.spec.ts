import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";

/**
 * Take-flow spacing session shots + header-gap measurement.
 * SHOT_MODE=before|after. Steps 2-4 share the header/step-stack shell this
 * session changes, so step 1 (reachable without a wallet) proves the fix;
 * in-step stacks already use the deliberate 24/16/12/8 rhythm (unchanged).
 */
const PASS = process.env.SHOT_PASS ?? "MgenhZMcSg";
const WIDTHS = [375, 1280];

test("take-flow-spacing shots", async ({ page }, testInfo) => {
  const mode = process.env.SHOT_MODE ?? "before";
  const outDir = resolve(process.cwd(), "..", "..", "design", "verify", "screenshots", "take-flow-spacing");
  mkdirSync(outDir, { recursive: true });
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto(`/passes/${PASS}/take`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    // Measured: header block bottom -> first field top.
    const gap = await page
      .evaluate(() => {
        const main = document.querySelector("main");
        if (!main) return null;
        const section = main.querySelector("section");
        const field = main.querySelector(".pass-field");
        if (!section || !field) return null;
        const s = section.getBoundingClientRect();
        const f = field.getBoundingClientRect();
        return Math.round(f.top - s.bottom);
      })
      .catch(() => null);
    console.log(`TAKEGAP-MEASURE w=${w} header-to-form=${gap}px`);
    await page.screenshot({
      path: join(outDir, `take-step1-${w}-${mode}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
});
