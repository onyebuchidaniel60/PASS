import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Screen verification harness — a MEASUREMENT instrument, not a pass/fail suite.
 *
 * Every check runs in the page and returns structured data. Failures are
 * collected and written to `design/verify/latest.txt` rather than thrown, so one
 * broken route cannot hide the state of the other thirteen. The only hard
 * `expect` is that the harness itself ran.
 *
 * Checks, per route, per viewport:
 *   1. overflow       any box past window.innerWidth by > 1px
 *   2. overlap        sibling block boxes intersecting when they should not
 *   3. target-size    button / [role=button] under 44x44
 *   4. clipped-text   scrollWidth past clientWidth with no ellipsis/overflow
 *   5. above-fold     (Pass detail @375) where each key element starts
 *   6. console        console.error + unhandled rejections
 *   7. network        non-2xx API responses
 */

const ROUTES = [
  "/",
  "/discover",
  "/p/UvvuxpWPZ4",
  "/u/turnttfup99",
  "/passes/UvvuxpWPZ4/take",
  "/help",
  "/faqs",
  "/how-it-works",
  "/contact",
  "/me/passes",
  "/me/executions",
  "/settings",
  "/onboarding",
  "/gallery",
] as const;

const EXPECT_404 = new Set(["/gallery"]);

/** Minimum interactive target, DESIGN.md §8.5 / WCAG 2.5.8. */
const MIN_TARGET = 44;

interface Finding {
  route: string;
  viewport: string;
  kind: string;
  detail: string;
}

/**
 * Runs in the browser. Kept as one serialisable function so the page never has
 * to be re-entered mid-measurement.
 */
async function measure(page: Page) {
  return await page.evaluate((minTarget) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      const label =
        (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || null;
      return `${tag}${role ? `[role=${role}]` : ""}${id}${cls}${
        label ? ` "${label}"` : ""
      }`;
    };

    const visible = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
    };

    /**
     * Decorative background layers. §14.1 places the wash, grain and watermark
     * behind content on purpose, so they ALWAYS overlap the content boxes and
     * reporting that is pure noise. Identified structurally rather than by class
     * name: inert (pointer-events: none) AND behind the content (negative
     * z-index, or a zero-opacity/behind-sibling stacking position).
     */
    const decorative = (el: Element): boolean => {
      const s = getComputedStyle(el);
      if (s.pointerEvents !== "none") return false;
      const z = Number(s.zIndex);
      if (Number.isFinite(z) && z < 0) return true;
      return el.matches(
        ".pass-wash-layer, .pass-grain, .pass-watermark, .pass-landing-field, .pass-brackets-foot, .pass-brackets-head",
      );
    };

    const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));

    /**
     * True when `el` lives inside a horizontally scrollable container.
     *
     * A ticker or a carousel is SUPPOSED to have children extending past the
     * viewport — that is what makes it scrollable. Reporting them as page
     * overflow produced 13 false positives on /discover alone (`.pass-ticker`
     * is `overflow-x: auto` by design). Real page overflow is caught separately
     * by the document `scrollWidth` check.
     */
    const insideScroller = (el: Element): boolean => {
      let p: Element | null = el.parentElement;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
        p = p.parentElement;
      }
      return false;
    };

    // 1. overflow
    const overflow = all
      .filter(visible)
      .filter((el) => !insideScroller(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.right > vw + 1 || r.left < -1)
      .slice(0, 12)
      .map(({ el, r }) => {
        const over = Math.round(Math.max(r.right - vw, -r.left));
        return `${describe(el)} right=${Math.round(r.right)}px viewport=${vw}px +${over}px`;
      });

    // 2. overlap between sibling boxes that both occupy vertical space
    const overlap: string[] = [];
    const containers = all.filter((el) => {
      if (!visible(el) || decorative(el)) return false;
      const s = getComputedStyle(el);
      if (s.position === "fixed" || s.position === "absolute" || s.position === "sticky") return false;
      const kids = Array.from(el.children).filter((c) => visible(c as HTMLElement));
      if (kids.length < 2) return false;
      return kids.some((c) => {
        const cs = getComputedStyle(c as HTMLElement);
        return cs.display.startsWith("block") || cs.display === "flex" || cs.display === "grid";
      });
    });

    for (const parent of containers.slice(0, 60)) {
      // Only in-flow siblings. A decorated wrapper (`.pass-brackets` renders a
      // `.pass-brackets-foot` absolutely positioned behind its child) legitimately
      // encloses its content box; that is not a collision.
      const kids = Array.from(parent.children).filter((c) => {
        if (!visible(c as HTMLElement) || decorative(c as HTMLElement)) return false;
        const cs = getComputedStyle(c as HTMLElement);
        return cs.position === "static" || cs.position === "relative";
      });
      for (let i = 0; i < kids.length; i += 1) {
        for (let j = i + 1; j < kids.length; j += 1) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          // Only report a real intersection: >2px on both axes.
          if (ix > 2 && iy > 2) {
            overlap.push(
              `${describe(kids[i])} overlaps ${describe(kids[j])} by ${Math.round(ix)}x${Math.round(iy)}px`,
            );
          }
        }
      }
      if (overlap.length > 12) break;
    }

    // 3. target size
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], [role="button"], input[type="submit"], input[type="button"]',
      ),
    )
      .filter(visible)
      // Screen-reader-only links are 1x1 by design (`.visually-hidden`) and are
      // not pointer targets at all. Counting them produced 14 false positives on
      // /discover alone.
      .filter((el) => !el.closest(".visually-hidden") && !el.matches(".visually-hidden"))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .filter(({ el, r }) => {
        // Inline links inside prose are not controls; exempt them.
        const s = getComputedStyle(el);
        if (s.display === "inline" && el.tagName === "A") return false;
        return r.width < minTarget - 0.5 || r.height < minTarget - 0.5;
      })
      .slice(0, 15)
      .map(({ el, r }) => `${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}px`);

    // 4. clipped text
    const clipped = all
      .filter(visible)
      .filter((el) => {
        if (el.children.length > 0) return false; // leaf text nodes only
        const s = getComputedStyle(el);
        if (s.textOverflow === "ellipsis") return false;
        if (s.overflow === "hidden" || s.overflowX === "hidden") return false;
        if ((el.textContent ?? "").trim() === "") return false;
        return el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0;
      })
      .slice(0, 12)
      .map(
        (el) =>
          `${describe(el)} scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth}`,
      );

    // 5. above-the-fold landmarks (Pass detail)
    const findLandmark = (selectors: string[]): string | null => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          const state = r.top < vh && r.bottom > 0 ? "visible" : "below-fold";
          return `${describe(el)} ${state}@${Math.round(r.top)}px`;
        }
      }
      return null;
    };

    const aboveFold = {
      status: findLandmark([".pass-badge", ".pass-chip[data-state]"]),
      asset: findLandmark([".pass-display", ".pass-display-line", "h1"]),
      metrics: findLandmark([".pass-metric-cards", ".pass-metric-card"]),
      cta: findLandmark(['a[href*="/take"] button', ".pass-landing-cta-primary"]),
    };

    return {
      viewport: `${vw}x${vh}`,
      documentScrollWidth: document.documentElement.scrollWidth,
      overflow,
      overlap,
      targets,
      clipped,
      aboveFold,
    };
  }, MIN_TARGET);
}

test.describe("PASS screen verification", () => {
  test("measure every route at both viewports", async ({ page }, testInfo) => {
    const viewportLabel = `${testInfo.project.name} ${
      testInfo.project.use?.viewport?.width
    }x${testInfo.project.use?.viewport?.height}`;

    const findings: Finding[] = [];
    const report: string[] = [];

    const consoleErrors: string[] = [];
    const networkFailures: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`unhandled: ${String(err).slice(0, 200)}`);
    });
    page.on("response", (res) => {
      const url = res.url();
      if (res.status() < 400) return;
      if (!/pass-api-production|127\.0\.0\.1:4000|localhost:4000/.test(url)) return;
      // A 401 on the session probe is the auth gate doing its job, not a broken
      // request. The harness runs signed out, so flagging it would mean every
      // authenticated route always reports a failure that no fix can remove.
      if (res.status() === 401 && /\/api\/v1\/me(\?|$)/.test(url)) return;
      networkFailures.push(`${res.status()} ${url.replace(/^https?:\/\//, "").slice(0, 90)}`);
    });

    for (const route of ROUTES) {
      consoleErrors.length = 0;
      networkFailures.length = 0;

      // `networkidle` is unreliable against `next dev`: the HMR websocket stays
      // open forever, so it never settles and the navigation aborts. `load` plus
      // a tolerant settle wait measures the same thing without that dependency.
      const res = await page.goto(route, { waitUntil: "load" });
      await page
        .waitForLoadState("networkidle", { timeout: 8_000 })
        .catch(() => {});
      // Let client-side data settle so we do not measure a loading skeleton.
      await page.waitForTimeout(400);
      const status = res?.status() ?? 0;
      const expect404 = EXPECT_404.has(route);

      report.push(`\nROUTE ${route} @ ${viewportLabel}  [http ${status}]`);

      if (expect404) {
        report.push(
          `  expected-404: ${status === 404 ? "ok" : `UNEXPECTED (got ${status})`}`,
        );
        continue;
      }

      const m = await measure(page);

      const hOverflow =
        m.documentScrollWidth > m.viewport.split("x")[0].length
          ? m.documentScrollWidth
          : null;
      if (m.documentScrollWidth > Number(m.viewport.split("x")[0]) + 1) {
        findings.push({
          route,
          viewport: viewportLabel,
          kind: "page-hscroll",
          detail: `document scrollWidth ${m.documentScrollWidth} > viewport ${m.viewport}`,
        });
      }

      report.push(
        `  overflow: ${m.overflow.length === 0 ? "0" : m.overflow.join(" | ")}`,
      );
      report.push(
        `  overlap: ${m.overlap.length === 0 ? "0" : m.overlap.join(" | ")}`,
      );
      report.push(
        `  target-size: ${m.targets.length === 0 ? "0" : m.targets.join(" | ")}`,
      );
      report.push(
        `  clipped-text: ${m.clipped.length === 0 ? "0" : m.clipped.join(" | ")}`,
      );
      if (route === "/p/UvvuxpWPZ4") {
        report.push(
          `  above-fold: status=${m.aboveFold.status ?? "MISSING"} | asset=${
            m.aboveFold.asset ?? "MISSING"
          } | metrics=${m.aboveFold.metrics ?? "MISSING"} | cta=${
            m.aboveFold.cta ?? "MISSING"
          }`,
        );
      }
      report.push(`  console: ${consoleErrors.length} errors${
        consoleErrors.length ? ` (${[...new Set(consoleErrors)].slice(0, 3).join(" ; ")})` : ""
      }`);
      report.push(
        `  network: ${networkFailures.length} failures${
          networkFailures.length ? ` (${[...new Set(networkFailures)].slice(0, 3).join(" ; ")})` : ""
        }`,
      );
      void hOverflow;

      for (const [kind, list] of [
        ["overflow", m.overflow],
        ["overlap", m.overlap],
        ["target-size", m.targets],
        ["clipped-text", m.clipped],
      ] as const) {
        for (const detail of list) {
          findings.push({ route, viewport: viewportLabel, kind, detail });
        }
      }
      for (const c of consoleErrors) {
        findings.push({ route, viewport: viewportLabel, kind: "console", detail: c });
      }
      for (const n of networkFailures) {
        findings.push({ route, viewport: viewportLabel, kind: "network", detail: n });
      }
    }

    const header = [
      `PASS screen verification`,
      `base: ${testInfo.project.use?.baseURL ?? "http://localhost:3000"}`,
      `viewport: ${viewportLabel}`,
      `routes: ${ROUTES.length}`,
      "",
      ...report,
      "",
      "=== SUMMARY ===",
      `total findings: ${findings.length}`,
    ];
    const byKind = new Map<string, number>();
    for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
    for (const [k, v] of [...byKind.entries()].sort()) {
      header.push(`  ${k}: ${v}`);
    }

    const outDir = resolve(process.cwd(), "..", "..", "design", "verify");
    mkdirSync(outDir, { recursive: true });
    const suffix = testInfo.project.name;
    writeFileSync(resolve(outDir, `latest-${suffix}.txt`), header.join("\n"), "utf8");

    // The instrument must work; the findings it reports are the content.
    expect(findings.length).toBeGreaterThanOrEqual(0);
  });
});