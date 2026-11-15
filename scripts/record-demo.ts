/**
 * Record the PASS demo flow with Playwright, synced to the voiceover timings.
 *
 * Usage:
 *   DEMO_BASE_URL=http://localhost:3000 pnpm video:record
 *
 * `public/demo/timings.json` is written by `scripts/generate-voiceover.ts`.
 * Each scene is held until its cumulative audio deadline, so the narration and
 * the screen cannot drift apart.
 *
 * The raw browser video lands in `public/demo/raw-video/raw-video.webm`.
 * `scripts/build-video.sh` mixes it with the voiceover and music.
 */
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL = (process.env.DEMO_BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const SESSION_COOKIE = process.env.DEMO_SESSION_COOKIE?.trim();
const RAW_DIR = resolve(process.cwd(), "public", "demo", "raw-video");
const RAW_FILE = join(RAW_DIR, "raw-video.webm");
const TIMINGS_FILE = resolve(process.cwd(), "public", "demo", "timings.json");
const LOGO_FILE = resolve(process.cwd(), "public", "readme", "logo.svg");

interface Timings {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  p5: number;
}

async function loadTimings(): Promise<Timings> {
  try {
    const parsed = JSON.parse(await readFile(TIMINGS_FILE, "utf8")) as Partial<Timings>;
    for (const key of ["p1", "p2", "p3", "p4", "p5"] as const) {
      if (!Number.isFinite(parsed[key]) || (parsed[key] ?? 0) <= 0) {
        throw new Error(`timings.json is missing a valid ${key}.`);
      }
    }
    return parsed as Timings;
  } catch (error) {
    throw new Error(
      `Could not read ${TIMINGS_FILE}. Run pnpm generate:voiceover first. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function titleCard(logo: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    min-height: 100%;
    background: #0a0a0a;
    color: #f5f1ea;
    font-family: "Inter Tight", "Archivo", ui-sans-serif, system-ui, sans-serif;
  }
  body {
    min-height: 100vh;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 48px;
    text-align: center;
  }
  .logo svg {
    width: 96px;
    height: 96px;
    display: block;
  }
  .kicker {
    color: #ff5a36;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0;
    font-size: clamp(2.5rem, 5vw, 4.8rem);
    line-height: 1.02;
    letter-spacing: -0.035em;
    font-weight: 700;
  }
  h1 span { color: #ff5a36; }
  p {
    margin: 0;
    color: #a8a29a;
    font-size: 18px;
    line-height: 1.4;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">${logo}</div>
    <div class="kicker">NEAR Intents × Hyperliquid</div>
    <h1>See a <span>trade</span>.<br />Know the trader.<br />Take the trade.</h1>
    <p>Built on NEAR. Executed on Hyperliquid.</p>
  </div>
</body>
</html>`;
}

async function hideDemoBanner(page: Page): Promise<void> {
  await page
    .addStyleTag({ content: ".pass-demo-banner{display:none !important}" })
    .catch(() => {});
}

async function go(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  // The banner is fetched after the first paint; hide it once it exists.
  await page.waitForTimeout(1_500);
  await hideDemoBanner(page);
}

async function main(): Promise<void> {
  const timings = await loadTimings();
  const total = timings.p1 + timings.p2 + timings.p3 + timings.p4 + timings.p5;
  const logo = await readFile(LOGO_FILE, "utf8");

  await mkdir(RAW_DIR, { recursive: true });
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
  if (SESSION_COOKIE) {
    await context.addCookies([
      {
        name: "pass_session",
        value: SESSION_COOKIE,
        domain: new URL(BASE_URL).hostname,
        path: "/",
      },
    ]);
  }
  const page = await context.newPage();

  // The local API is mock mode, so /health would render the demo banner. The
  // recording is a product demo, not an environment status screen: answer the
  // banner's health probe as a fully live deployment so the frame stays clean.
  await page.route("**/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        modes: {
          hyperliquid: "live",
          hyperliquidReads: "live",
          hyperliquidExecution: "live",
          ethos: "live",
          x: "live",
          database: "live",
        },
        demoMode: false,
      }),
    }),
  );

  // A dark first paint even before setContent runs. This is what prevents the
  // white flash that used to open the recording.
  await page.addInitScript(() => {
    if (document.documentElement) {
      document.documentElement.style.backgroundColor = "#0a0a0a";
    }
    if (document.body) {
      document.body.style.backgroundColor = "#0a0a0a";
    }
    const hide = () => {
      document.querySelectorAll<HTMLElement>(".pass-demo-banner").forEach((el) => {
        el.style.display = "none";
      });
    };
    // The banner is a local mock-mode artifact, not product UI.
    window.setInterval(hide, 250);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", hide, { once: true });
    } else {
      hide();
    }
  });

  const started = Date.now();
  async function holdUntil(ms: number): Promise<void> {
    const remaining = started + ms - Date.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
  }

  try {
    // p1 — dark title card. No app request, no white flash.
    await page.setContent(titleCard(logo), { waitUntil: "load" });
    await holdUntil(timings.p1);

    // p2 — app homepage.
    await go(page, "/app");
    await holdUntil(timings.p1 + timings.p2);

    // p3 — Discover first, then the selected Pass detail.
    await go(page, "/discover");
    const discoverHold = Math.min(1500, Math.floor(timings.p3 * 0.1));
    if (discoverHold > 0) await page.waitForTimeout(discoverHold);
    const openPass = page.locator(".pass-card-action").first();
    await openPass.waitFor({ timeout: 5_000 }).catch(() => {});
    if (await openPass.count()) {
      await openPass.click().catch(() => go(page, "/discover"));
      await hideDemoBanner(page);
    }
    await holdUntil(timings.p1 + timings.p2 + timings.p3);

    // p4 — Take flow. Start the transition just before the paragraph so the
    // first frame of "Watch the flow" is already the Take screen.
    await holdUntil(timings.p1 + timings.p2 + timings.p3 - 1_000);
    const take = page.getByRole("link", { name: /Take Pass/i }).first();
    if (await take.count()) {
      await take.click().catch(() => go(page, "/discover"));
      await page.waitForTimeout(1_500);
      await hideDemoBanner(page);
    } else {
      const current = new URL(page.url());
      const id = current.pathname.split("/").filter(Boolean).pop();
      await go(page, id ? `/passes/${id}/take` : "/discover");
    }
    await holdUntil(timings.p1 + timings.p2 + timings.p3 + timings.p4);

    // p5 — Settings → Developers. Pre-navigate so the screen is ready when
    // the agent-economy paragraph begins.
    await holdUntil(total - timings.p5 - 1_000);
    await go(page, "/settings?tab=developers");
    await holdUntil(total);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const source = await video.path();
      await copyFile(source, RAW_FILE);
      await rm(source, { force: true });
      console.log(`[video] raw recording: ${RAW_FILE}`);
      console.log(`[video] synced timeline: ${total}ms`);
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
