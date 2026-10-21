import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Mobile overflow audit — measurement instrument (verify-screens pattern).
 *
 * Visits every production route at 375px and 390px and reports, as data:
 *   1. page-hscroll  document scrollWidth vs window.innerWidth
 *   2. overflow      visible boxes extending past the viewport, excluding
 *                    children of a designed horizontal scroller (ticker, topbar
 *                    nav row on mobile) — but the document scrollWidth check in
 *                    the DIAGNOSTICS lap catches overflow real page content
 *                    causes even then.
 *   3. clipped-text  leaf elements whose content is wider than the box,
 *                    excluding designed truncation (overflow hidden +
 *                    text-overflow ellipsis, which is a deliberate affordance)
 *
 * One test PER ROUTE per width: a route that crashes the browser is retried in
 * isolation instead of stopping the other seven (`--retries=1`).
 * Screenshots land in design/verify/screenshots/mobile-audit/{width}/.
 * Per-route findings land in design/verify/mobile-audit-{width}-{route}.txt.
 *
 * Signed-out routes measure their signed-out states; when a local demo API +
 * PASS_TEST_SESSION_COOKIE are present, the authenticated routes measure their
 * signed-in states too (same convention as demo-pass-shots.spec.ts).
 */

const COOKIE = process.env.PASS_TEST_SESSION_COOKIE ?? "";

/** All 8 audited production routes. */
const ROUTES: Array<{ name: string; path: string }> = [
  { name: "landing", path: "/" },
  { name: "discover", path: "/discover" },
  { name: "mypasses", path: "/me/passes" },
  { name: "executions", path: "/me/executions" },
  { name: "settings", path: "/settings" },
  { name: "pass-detail", path: ":passDetailPath" },
  { name: "take", path: ":takePath" },
  { name: "trader", path: ":traderPath" },
];

interface Finding {
  kind: string;
  detail: string;
}

/** Resolved before the routes run; depends on the live local demo API. */
const dynamicPaths: Record<string, string> = {
  passDetailPath: "/p/DEMOT01",
  takePath: "/passes/DEMOT01/take",
  traderPath: "/u/turnttfup99",
};

test.describe.configure({ mode: "default" });

test.beforeAll(async ({ request }) => {
  // Resolve the demo Pass ids from the local API when available. Static
  // fallbacks keep the audit functional against the deployed API alone.
  // Page warm-up is deliberately NOT done here: routes are precompiled with
  // HTTP probes before the run (a cold `next dev` compile can exceed this
  // hook's budget), and `next start` serves precompiled routes instantly.
  try {
    const res = await request.get(
      `${process.env.E2E_API_URL ?? "http://127.0.0.1:4000"}/api/v1/profiles/turnttfup99/passes`,
    );
    if (res.ok()) {
      const body = (await res.json()) as { passes?: Array<{ publicId: string }> };
      const id = body.passes?.[0]?.publicId;
      if (id) {
        dynamicPaths.passDetailPath = `/p/${id}`;
        dynamicPaths.takePath = `/passes/${id}/take`;
      }
    }
  } catch {
    // No local API: fall back to the deployed-API slugs.
  }
});

/**
 * Runs in the page. Serialisable, like the verify-screens harness measure().
 * Reports overflowing boxes plus a 4-level ancestor chain so a culprit can be
 * located without a second run.
 */
async function measure(page: Page, mode: "primary" | "diagnostics" = "primary") {
  return await page.evaluate((runMode) => {
    const vw = window.innerWidth;
    const describe = (el: Element): string => {
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      const label = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${cls}${label ? ` "${label}"` : ""}`;
    };
    const chain = (el: Element, depth = 4): string => {
      const out: string[] = [];
      let p: Element | null = el.parentElement;
      while (p && p !== document.body && out.length < depth) {
        out.push(describe(p));
        p = p.parentElement;
      }
      return out.join(" <- ");
    };
    const visible = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
    };
    const insideScroller = (el: Element): boolean => {
      let p: Element | null = el.parentElement;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
        p = p.parentElement;
      }
      return false;
    };
    const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));

    const primary = Array.from(document.querySelectorAll<HTMLElement>("body > *"));
    const extras = runMode === "diagnostics" ? Array.from(document.querySelectorAll<HTMLElement>(".pass-ticker, .pass-topbar-nav")) : [];

    const overflow = [...primary, ...extras]
      .flatMap((root) => [
        root,
        ...Array.from(root.querySelectorAll<HTMLElement>("*")),
      ])
      .filter(visible)
      .filter((el) => !insideScroller(el))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.right > vw + 1 || r.left < -1)
      .slice(0, 10)
      .map(
        ({ el, r }) =>
          `${describe(el)} right=${Math.round(r.right)} viewport=${vw} over=${Math.round(
            Math.max(r.right - vw, -r.left),
          )}px | ${chain(el)}`,
      );

    const clipped = all
      .filter(visible)
      .filter((el) => !insideScroller(el))
      // Screen-reader-only elements are 1x1 by design (not clipped content).
      .filter((el) => !el.closest(".visually-hidden") && !el.matches(".visually-hidden"))
      .filter((el) => {
        if (el.children.length > 0) return false;
        if ((el.textContent ?? "").trim() === "") return false;
        if (el.scrollWidth <= el.clientWidth + 2 || el.clientWidth <= 0) return false;
        // Designed truncation: an explicit ellipsis affordance is a value, not
        // accidental clipping; a bare clip (no ellipsis) still reports.
        const s = getComputedStyle(el);
        return !(s.overflowX === "hidden" && s.textOverflow === "ellipsis");
      })
      .slice(0, 8)
      .map((el) => `${describe(el)} scroll=${el.scrollWidth} client=${el.clientWidth}`);

    return {
      vw,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflow,
      clipped,
      topbarOverflow: Array.from(document.querySelectorAll(".pass-topbar *"))
        .filter(visible)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > vw + 1;
        })
        .slice(0, 5)
        .map((el) => `${describe(el)} | ${chain(el, 2)}`),
    };
  }, mode);
}

const WIDTHS = [375, 390];

for (const width of WIDTHS) {
  test.describe(`mobile audit @${width}`, () => {
    test.use({ viewport: { width, height: 812 } });

    for (const route of ROUTES) {
      test(`${route.name}`, async ({ page }) => {
        const path = route.path.startsWith(":")
          ? dynamicPaths[route.path.slice(1)]
          : route.path;

        const findings: Finding[] = [];
        const report: string[] = [];
        const shotDir = resolve(
          process.cwd(),
          "..",
          "..",
          "design",
          "verify",
          "screenshots",
          "mobile-audit",
          String(width),
        );
        mkdirSync(shotDir, { recursive: true });

        if (COOKIE && page.url() === "about:blank") {
          await page.context().addCookies([
            { name: "pass_session", value: COOKIE, domain: "localhost", path: "/" },
          ]);
        }

        const res = await page.goto(path, { waitUntil: "load" });
        await page
          .waitForLoadState("networkidle", { timeout: 8_000 })
          .catch(() => {});
        await page.waitForTimeout(400);
        const m = await measure(page);

        report.push(`ROUTE ${route.name} (${path}) @ ${width}px [http ${res?.status()}]`);
        report.push(`  scrollWidth=${m.scrollWidth} innerWidth=${m.vw} bodyScroll=${m.bodyScrollWidth}`);

        // Screenshot FIRST: the visual record survives any finding logic.
        await page.screenshot({
          path: join(shotDir, `${route.name}.png`),
          fullPage: true,
        });

        if (m.scrollWidth > m.vw + 1 || m.bodyScrollWidth > m.vw + 1) {
          findings.push({
            kind: "page-hscroll",
            detail: `document scrollWidth ${m.scrollWidth}/body ${m.bodyScrollWidth} > viewport ${m.vw}`,
          });
        }
        if (m.overflow.length > 0) {
          report.push(`  overflow: ${m.overflow.join(" | ")}`);
          for (const o of m.overflow) {
            findings.push({ kind: "overflow", detail: o });
          }
        }
        if (m.clipped.length > 0) {
          report.push(`  clipped-text: ${m.clipped.join(" | ")}`);
          for (const t of m.clipped) {
            findings.push({ kind: "clipped-text", detail: t });
          }
        }
        if (m.topbarOverflow.length > 0) {
          report.push(`  topbar-overflow: ${m.topbarOverflow.join(" | ")}`);
          for (const t of m.topbarOverflow) {
            findings.push({ kind: "topbar-overflow", detail: t });
          }
        }

        writeFileSync(
          resolve(
            process.cwd(),
            "..",
            "..",
            "design",
            "verify",
            `mobile-audit-${width}-${route.name}.txt`,
          ),
          ["PASS mobile overflow audit", "", ...report, ""].join("\n"),
          "utf8",
        );
        for (const f of findings) {
          expect.soft(false, `${route.name} @${width}px [${f.kind}] ${f.detail}`).toBe(true);
        }
        expect(true).toBe(true);
      });
    }
  });
}
