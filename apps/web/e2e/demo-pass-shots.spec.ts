import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "@playwright/test";

/**
 * Demo-pass shot helper (visual session only).
 * SHOT_MODE=before|after, SHOT_SCREENS=comma list (default: all).
 */
const ALL: Array<[string, string]> = [
  ["landing", "/"],
  ["onboarding", "/onboarding"],
  ["create", "/passes/new"],
  ["pass-detail", "/p/UvvuxpWPZ4"],
  ["take", "/passes/UvvuxpWPZ4/take"],
  ["executions", "/me/executions"],
  ["trader", "/u/turnttfup99"],
];

test("demo-pass shots", async ({ page }, testInfo) => {
  const mode = process.env.SHOT_MODE ?? "before";
  const only = (process.env.SHOT_SCREENS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const shots = only.length ? ALL.filter(([n]) => only.includes(n)) : ALL;
  const outDir = resolve(process.cwd(), "..", "..", "design", "verify", "screenshots", "demo-pass");
  mkdirSync(outDir, { recursive: true });
  for (const [name, route] of shots) {
    await page.goto(route, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(outDir, `${name}-${mode}-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }
});
