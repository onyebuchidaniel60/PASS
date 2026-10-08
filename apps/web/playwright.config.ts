import { defineConfig, devices } from "@playwright/test";

/**
 * Screen verification harness.
 *
 * NOT part of `pnpm check` — it needs a running server, so it is a separate
 * command (Task 0 requirement). Run it against a dev server or the deployed
 * alias:
 *
 *   pnpm --filter @pass/web dev            # or point E2E_BASE_URL elsewhere
 *   pnpm --filter @pass/web verify
 *
 * `channel: "chromium"` is deliberate. Playwright's default headless mode wants
 * a separate `chromium_headless_shell` download, which has repeatedly failed
 * here on DNS. The full Chrome-for-Testing binary is present and works, so both
 * projects pin the full browser instead.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // The harness reports violations as DATA rather than as pass/fail, so a single
  // failed assertion on one route does not hide the other thirteen.
  fullyParallel: false,
  workers: 1,
  // Generous on purpose: the sweep visits 14 routes in ONE test, and against
  // `next dev` a cold route can take 40s to compile. A per-navigation timeout
  // is the right granularity; a per-test one is not.
  timeout: 15 * 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    channel: "chromium",
    trace: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chromium", viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], channel: "chromium", viewport: { width: 375, height: 812 }, isMobile: false },
    },
  ],
});