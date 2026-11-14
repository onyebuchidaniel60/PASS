/**
 * Record the PASS demo flow with Playwright.
 *
 * Usage:
 *   DEMO_BASE_URL=http://localhost:3000 pnpm video:record
 *
 * The raw browser video lands in `public/demo/raw-video/raw-video.webm`.
 * `scripts/build-video.sh` then mixes it with the voiceover and music.
 *
 * The scene durations are deliberately long: the voiceover is about two
 * minutes, and the demo needs breathing room for each screen. `-shortest` in
 * the assembly script trims the final cut to the narration.
 */
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL = (process.env.DEMO_BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const PACE = Number(process.env.DEMO_PACE ?? "1");
const RAW_DIR = resolve(process.cwd(), "public", "demo", "raw-video");
const RAW_FILE = join(RAW_DIR, "raw-video.webm");

function wait(page: Page, ms: number): Promise<void> {
  return page.waitForTimeout(Math.round(ms * PACE));
}

async function go(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
}

async function main(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  // A previous run must not be silently reused by the assembly script.
  for (const file of await readdir(RAW_DIR).catch(() => [])) {
    if (file.endsWith(".webm")) await rm(join(RAW_DIR, file), { force: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: RAW_DIR,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();

  try {
    // 0:00–0:20 — homepage.
    await go(page, "/");
    await wait(page, 20_000);

    // 0:20–0:40 — Discover.
    await page
      .getByRole("link", { name: "Discover" })
      .first()
      .click()
      .catch(() => go(page, "/discover"));
    await wait(page, 20_000);

    // 0:40–1:05 — a single Pass detail.
    const openPass = page.locator(".pass-card-action").first();
    if (await openPass.count()) {
      await openPass.click().catch(() => go(page, "/discover"));
    } else {
      await go(page, "/discover");
    }
    await wait(page, 25_000);

    // 1:05–1:35 — Take flow, size selection.
    const take = page.getByRole("link", { name: /Take Pass/i }).first();
    if (await take.count()) {
      await take.click().catch(() => go(page, "/discover"));
    } else {
      await go(page, "/discover");
    }
    await wait(page, 30_000);

    // 1:35–2:10 — Create Pass.
    await go(page, "/passes/new");
    await wait(page, 35_000);

    // 2:10–2:30 — hold on the authored object / preview.
    await page.mouse.wheel(0, 500).catch(() => {});
    await wait(page, 20_000);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const source = await video.path();
      await copyFile(source, RAW_FILE);
      await rm(source, { force: true });
      console.log(`[video] raw recording: ${RAW_FILE}`);
    } else {
      console.warn("[video] Playwright did not expose a video handle.");
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    `[video] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
