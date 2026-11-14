import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";

import type { HomeDto } from "@pass/contracts";

import { LandingView } from "@/app/LandingView";
import { prefersReducedMotion } from "@/motion";

/**
 * Landing screen — design/DESIGN.md §10.1, docs/UX_SPEC.md §4.
 *
 * §10 states the eye order is a testable requirement: hero line, then the CTAs,
 * then the loop strip, then the support line. The hero and both CTAs are
 * asserted here. The support line and loop are asserted too, because a screen
 * missing its fixed copy is a spec failure, not a cosmetic one.
 *
 * The view receives the public home feed as a prop, so these tests exercise the
 * populated and empty states without a network request. The server page is the
 * only place that fetches; it degrades to the same empty feed if the API is
 * unreachable.
 */
const HOME: HomeDto = {
  demoMode: false,
  topTraders: [
    {
      slug: "alphatrader",
      handle: "alphatrader",
      displayName: "AlphaTrader",
      avatarUrl: null,
      publishedPasses: 2,
      activePasses: 2,
      completedExecutions: 25,
      winRatePct: 76,
      pnlPct: 42.8,
      pnlUsd: "10700",
      sparkline: [0, 640, 1280, 1060, 1710, 2350, 3020, 3550, 4200, 4870, 5530, 6190, 6840, 7520],
    },
    {
      slug: "zentrades",
      handle: "zentrades",
      displayName: "Zen",
      avatarUrl: null,
      publishedPasses: 2,
      activePasses: 2,
      completedExecutions: 18,
      winRatePct: 72.22,
      pnlPct: 36,
      pnlUsd: "6480",
      sparkline: [0, 310, 640, 460, 980, 1310, 1660, 2010, 2360, 2700, 3040, 3400, 3740, 4080],
    },
    {
      slug: "matrixtrades",
      handle: "matrixtrades",
      displayName: "Matrix",
      avatarUrl: null,
      publishedPasses: 2,
      activePasses: 2,
      completedExecutions: 26,
      winRatePct: 69.23,
      pnlPct: 32.5,
      pnlUsd: "8450",
      sparkline: [0, 280, 610, 900, 690, 1100, 1450, 1790, 2110, 2460, 2800, 3130, 3470, 3820],
    },
    {
      slug: "solacedoteth",
      handle: "solacedoteth",
      displayName: "Solace",
      avatarUrl: null,
      publishedPasses: 2,
      activePasses: 2,
      completedExecutions: 20,
      winRatePct: 75,
      pnlPct: 39.5,
      pnlUsd: "7900",
      sparkline: [0, 410, 820, 610, 1040, 1420, 1810, 2200, 2560, 2940, 3310, 3690, 4070, 4450],
    },
  ],
  activity: [
    {
      id: "execution:1",
      kind: "execution",
      actor: {
        slug: "alphatrader",
        handle: "alphatrader",
        displayName: "AlphaTrader",
        avatarUrl: null,
      },
      pass: {
        publicId: "AGENT01",
        asset: "BTC",
        direction: "long",
        status: "tp_hit",
      },
      at: new Date(Date.now() - 2 * 60_000).toISOString(),
      sizeUsd: "1000",
      pnlUsd: "640",
    },
    {
      id: "published:2",
      kind: "published",
      actor: {
        slug: "zentrades",
        handle: "zentrades",
        displayName: "Zen",
        avatarUrl: null,
      },
      pass: {
        publicId: "AGENT03",
        asset: "SOL",
        direction: "long",
        status: "active",
      },
      at: new Date(Date.now() - 7 * 60 * 60_000).toISOString(),
      sizeUsd: null,
      pnlUsd: null,
    },
    {
      id: "execution:3",
      kind: "execution",
      actor: {
        slug: "matrixtrades",
        handle: "matrixtrades",
        displayName: "Matrix",
        avatarUrl: null,
      },
      pass: {
        publicId: "AGENT05",
        asset: "ETH",
        direction: "long",
        status: "sl_hit",
      },
      at: new Date(Date.now() - 11 * 60 * 60_000).toISOString(),
      sizeUsd: "1000",
      pnlUsd: "-294",
    },
  ],
};

function setReduced(reduced: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (q: string) =>
      ({
        matches: reduced && q.includes("reduced-motion"),
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

afterEach(() => setReduced(false));

describe("Landing hero (§10.1 item 1)", () => {
  it("renders the hero line verbatim", () => {
    // §1.3 fixes this copy: PRD §18 and UX_SPEC §4.
    render(<LandingView home={HOME} />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "See a trade. Know the trader. Take the trade.",
      }),
    ).toBeInTheDocument();
  });

  it("is the first heading on the page", () => {
    const { container } = render(<LandingView home={HOME} />);
    expect(container.querySelector("h1")).not.toBeNull();
  });

  it("renders exactly one signal line, with a reticle node", () => {
    const { container } = render(<LandingView home={HOME} />);
    expect(container.querySelectorAll(".pass-signal-line")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Signal line origin" })).toBeInTheDocument();
  });

  it("reveals the signal line once, as the hero device", () => {
    const { container } = render(<LandingView home={HOME} />);
    expect(container.querySelector(".pass-signal-line")).toHaveAttribute(
      "data-reveal",
      "true",
    );
  });
});

describe("Landing CTAs (§10.1 item 2)", () => {
  it("renders Explore Passes as the single accent-filled action", () => {
    const { container } = render(<LandingView home={HOME} />);
    const explore = screen.getByRole("link", { name: "Explore Passes" });
    expect(explore).toHaveAttribute("href", "/discover");
    const btn = explore.querySelector("[data-variant]");
    expect(btn).toHaveAttribute("data-variant", "primary");
    // §2.5 the accent marks ONE thing per viewport.
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it("renders Create a Pass as ghost and never accented", () => {
    const { container } = render(<LandingView home={HOME} />);
    const hero = container.querySelector(".pass-landing-ctas") as HTMLElement;
    const create = within(hero).getByRole("link", { name: "Create a Pass" });
    expect(create).toHaveAttribute("href", "/passes/new");
    expect(create.querySelector("[data-variant]")).toHaveAttribute(
      "data-variant",
      "ghost",
    );
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it("links to real destinations, not placeholders", () => {
    const { container } = render(<LandingView home={HOME} />);
    const hero = container.querySelector(".pass-landing-ctas") as HTMLElement;
    expect(
      within(hero).getByRole("link", { name: "Explore Passes" }),
    ).toHaveAttribute("href", "/discover");
    expect(
      within(hero).getByRole("link", { name: "Create a Pass" }),
    ).toHaveAttribute("href", "/passes/new");
  });
});

describe("Landing loop strip (§10.1 item 3)", () => {
  it("states all five steps of the loop", () => {
    render(<LandingView home={HOME} />);
    for (const label of [
      "X post",
      "Pass",
      "trader context",
      "trade plan",
      "Hyperliquid",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("is an ordered list, so the sequence is conveyed structurally", () => {
    const { container } = render(<LandingView home={HOME} />);
    expect(container.querySelectorAll("ol.pass-loop-strip > li")).toHaveLength(5);
  });

  it("uses no stock imagery; every glyph is structural or labelled", () => {
    const { container } = render(<LandingView home={HOME} />);
    // §12.2 forbids decorative illustration and stock imagery. The reticle and
    // feature glyphs are structural, the sparklines are labelled data charts,
    // and none of them is a photograph or a decorative illustration.
    expect(container.querySelector(".pass-reticle")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("picture")).toBeNull();
    for (const glyph of Array.from(
      container.querySelectorAll(".pass-feature-glyph"),
    )) {
      expect(glyph).toHaveAttribute("aria-hidden", "true");
    }
    for (const spark of Array.from(
      container.querySelectorAll(".pass-sparkline"),
    )) {
      expect(spark).toHaveAttribute("role", "img");
      expect(spark).toHaveAttribute("aria-label");
    }
  });
});

describe("Landing Top Traders (homepage expansion)", () => {
  it("renders the seeded trader record with win rate, PnL and a sparkline", () => {
    const { container } = render(<LandingView home={HOME} />);
    for (const name of ["AlphaTrader", "Zen", "Matrix", "Solace"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(container.querySelectorAll(".pass-trader-card")).toHaveLength(4);
    expect(screen.getAllByText("Win rate")).toHaveLength(4);
    expect(screen.getByText("+42.8%")).toBeInTheDocument();
    expect(container.querySelectorAll(".pass-trader-card .pass-sparkline")).toHaveLength(4);
  });

  it("links to Discover and offers the Be a Trader card", () => {
    render(<LandingView home={HOME} />);
    expect(screen.getByRole("link", { name: /View All/ })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(screen.getByText("Be a Trader")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Publish the plan/ }),
    ).toHaveAttribute("href", "/passes/new");
  });

  it("does not fabricate traders when the feed is empty", () => {
    const { container } = render(
      <LandingView home={{ ...HOME, topTraders: [] }} />,
    );
    expect(container.querySelectorAll(".pass-trader-card")).toHaveLength(0);
    expect(
      screen.getByText("No public trader record yet. The first Pass starts it."),
    ).toBeInTheDocument();
  });
});

describe("Landing Live Activity (homepage expansion)", () => {
  it("renders executions and publications as a ledger with a live status", () => {
    const { container } = render(<LandingView home={HOME} />);
    const live = screen.getByRole("status", { name: "Live activity feed" });
    expect(live).toHaveTextContent("Live");
    expect(container.querySelectorAll(".pass-activity-row")).toHaveLength(3);
    expect(container.textContent).toContain("executed");
    expect(container.textContent).toContain("published");
    expect(container.textContent).toContain("TP hit");
    expect(container.textContent).toContain("SL hit");
  });

  it("does not fabricate activity when the feed is empty", () => {
    render(<LandingView home={{ ...HOME, activity: [] }} />);
    expect(
      screen.getByText(
        "No public activity yet. The first plan is one click away.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Landing trust sections (homepage expansion)", () => {
  it("names the four product pillars", () => {
    render(<LandingView home={HOME} />);
    for (const title of [
      "Non-custodial",
      "Transparent plans",
      "Real trades on Hyperliquid",
      "NEAR Intents funding",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
  });

  it("explains the scoped agent key and links to Developer settings", () => {
    render(<LandingView home={HOME} />);
    expect(
      screen.getByRole("heading", { name: "Build on the execution layer." }),
    ).toBeInTheDocument();
    expect(screen.getByText("No withdrawal authority")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open Developer settings/ }),
    ).toHaveAttribute("href", "/settings?tab=developers");
  });

  it("closes with both calls to action", () => {
    const { container } = render(<LandingView home={HOME} />);
    const final = container.querySelector(".pass-final-cta") as HTMLElement;
    expect(within(final).getByRole("link", { name: /Explore Traders/ })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(within(final).getByRole("link", { name: "Create a Pass" })).toHaveAttribute(
      "href",
      "/passes/new",
    );
  });

  it("wraps the long-form sections in scroll reveals", () => {
    const { container } = render(<LandingView home={HOME} />);
    expect(container.querySelectorAll(".pass-reveal")).toHaveLength(6);
  });
});

describe("Landing composition rules", () => {
  it("puts the GridField behind the hero only, and inert", () => {
    const { container } = render(<LandingView home={HOME} />);
    const field = container.querySelector(".pass-landing-field");
    expect(field).not.toBeNull();
    // Structural, never interactive, and aria-hidden in the component itself.
    expect(container.querySelector(".pass-grid-field")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows no emoji and no exclamation marks (§12.2, §12.4)", () => {
    const { container } = render(<LandingView home={HOME} />);
    expect(container.textContent).not.toMatch(/[!]/);
    expect(container.textContent).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    );
  });

  it("contains no forbidden casino or guarantee copy (§12.4)", () => {
    const { container } = render(<LandingView home={HOME} />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const word of [
      "guaranteed",
      "risk-free",
      "jackpot",
      "moon",
      "locked in",
      "closing soon",
      "people are taking",
    ]) {
      expect(text, word).not.toContain(word);
    }
    // "AlphaTrader" is a proper name, not the finance-hype noun.
    expect(text).not.toMatch(/\balpha\b/);
  });

  it("uses no urgency or scarcity language (§12.4)", () => {
    render(<LandingView home={HOME} />);
    expect(screen.queryByText(/countdown|ends in|hurry/i)).not.toBeInTheDocument();
  });
});

describe("Landing reduced-motion path (§6.6)", () => {
  it("reads motion as allowed by default", () => {
    setReduced(false);
    render(<LandingView home={HOME} />);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("honours the reduced-motion setting when it is on", () => {
    setReduced(true);
    render(<LandingView home={HOME} />);
    // The motion helpers must see the reduced path, which is what removes the
    // transform-based sweep rather than shortening it.
    expect(prefersReducedMotion()).toBe(true);
  });

  it("keeps the signal line present in the DOM under reduced motion", () => {
    setReduced(true);
    const { container } = render(<LandingView home={HOME} />);
    // It must render in its FINAL state, not be removed: the rule is that no
    // element moves, not that content disappears.
    expect(container.querySelector(".pass-signal-line")).not.toBeNull();
    expect(container.querySelector(".pass-signal-line hr")).not.toBeNull();
  });
});

/**
 * §14 assertions. Added 2026-10-07 when the Landing was rebuilt, because every
 * one of these is a clause the previous version silently failed while still
 * passing all 18 tests above. That is the point: the screen was compliant with
 * §§1–13 and wrong, and only new assertions caught it.
 */
describe("Landing reference language (§14)", () => {
  it("puts the hero on a wash shell with grain and a ghost watermark", () => {
    const { container } = render(<LandingView home={HOME} />);
    const shell = container.querySelector(".pass-landing-shell") as HTMLElement;
    expect(shell).toBeTruthy();
    expect(shell.getAttribute("data-strength")).toBe("hero");
    expect(shell.querySelector(".pass-wash-layer")).toBeTruthy();
    expect(shell.querySelector(".pass-grain")).toBeTruthy();
    expect(shell.querySelector(".pass-watermark")?.textContent).toBe("PASS");
  });

  it("frames the hero and the step grid with corner brackets, and nothing else", () => {
    const { container } = render(<LandingView home={HOME} />);
    // §14.2 rations these to four uses in the whole product. The Landing spends
    // two of them; a third here would mean the ration is not being enforced.
    expect(container.querySelectorAll(".pass-brackets")).toHaveLength(2);
  });

  it("sets one ember word on the hero's first line and none on the others", () => {
    const { container } = render(<LandingView home={HOME} />);
    const hero = container.querySelector(".pass-display") as HTMLElement;
    const lines = hero.querySelectorAll(".pass-display-line");
    expect(lines).toHaveLength(3);
    expect(lines[0].querySelectorAll(".pass-display-accent")).toHaveLength(1);
    expect(lines[0].querySelector(".pass-display-accent")?.textContent).toBe("trade.");
    expect(lines[1].querySelectorAll(".pass-display-accent")).toHaveLength(0);
    expect(lines[2].querySelectorAll(".pass-display-accent")).toHaveLength(0);
  });

  it("gives the hero an accessible name with the lines separated", () => {
    render(<LandingView home={HOME} />);
    // Each line is its own block span, so without an explicit name a screen
    // reader says "See a trade.Know the trader.Take the trade."
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "See a trade. Know the trader. Take the trade.",
      }),
    ).toBeInTheDocument();
  });

  it("numbers the six sections 01 through 06", () => {
    const { container } = render(<LandingView home={HOME} />);
    const numbers = Array.from(
      container.querySelectorAll(".pass-numbered-eyebrow-number"),
    ).map((n) => n.textContent?.replace(/\\/g, "").trim());
    expect(numbers).toEqual(["01", "02", "03", "04", "05", "06"]);
  });

  it("renders the four-step grid with a data card in each visual slot", () => {
    const { container } = render(<LandingView home={HOME} />);
    expect(container.querySelectorAll(".pass-steps")).toHaveLength(1);
    expect(container.querySelectorAll(".pass-step")).toHaveLength(4);
    // §14.10 forbids an image in the visual slot.
    expect(container.querySelectorAll(".pass-step-visual")).toHaveLength(4);
    expect(container.querySelectorAll(".pass-step-visual img")).toHaveLength(0);
    expect(container.querySelectorAll(".pass-step-visual .pass-metric-card")).toHaveLength(8);
  });

  it("puts the informational pages in the chip bar", () => {
    render(<LandingView home={HOME} />);
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "FAQs" })).toHaveAttribute("href", "/faqs");
  });

  it("keeps exactly one accent fill: the Explore Passes button", () => {
    const { container } = render(<LandingView home={HOME} />);
    // §2.5 rations the accent to one thing per viewport, and the step grid adds
    // eight metric cards. None of them may become an accent fill.
    expect(container.querySelectorAll(".pass-card-action")).toHaveLength(0);
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it("uses only the documented class vocabulary, so no bespoke class creeps in", () => {
    const { container } = render(<LandingView home={HOME} />);
    // `visually-hidden` is the screen-reader clip utility and is deliberately
    // NOT `pass-`-prefixed: it is a general utility, not a PASS component.
    const ALLOWED = new Set(["visually-hidden"]);
    const classes = Array.from(container.querySelectorAll("[class]")).flatMap((el) =>
      (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
    );
for (const c of classes) {
      expect(c.startsWith("pass-") || ALLOWED.has(c), `class "${c}"`).toBe(true);
    }
  });
});

/**
 * Footer regression, 2026-10-07 — operator report: "packed up the home and
 * bottom elements".
 *
 * All three causes lived in components.css and changed nothing in the markup, so
 * every existing assertion stayed green while the page was visibly wrong. The
 * first is the kind of bug no class-name test can ever catch: `.pass-footer`
 * declared `max-width` TWICE and CSS resolved it last-wins with no warning, so
 * the footer silently rendered at 68ch beside 1280px of content.
 *
 * These read the stylesheet rather than the DOM on purpose — the defect was in
 * the stylesheet, and asserting on the rendered class list would have stayed
 * green throughout.
 */
describe("Footer and hero shell layout regression (14.15)", () => {
  const css = readFileSync(
    // Not `new URL(..., import.meta.url)`: under the jsdom environment that is
    // not a file URL and `readFileSync` rejects it.
    resolve(process.cwd(), "src/styles/components.css"),
    "utf8",
  );

  /** The declaration block for a top-level `selector {` rule. */
  function ruleFor(selector: string): string {
    const at = css.indexOf(`\n${selector} {`);
    if (at < 0) return "";
    const open = css.indexOf("{", at);
    const close = css.indexOf("}", open);
    return css.slice(open + 1, close);
  }

  it("declares max-width exactly once on the footer", () => {
    const body = ruleFor(".pass-footer");
    expect(body).not.toBe("");
    expect((body.match(/max-width:/g) ?? []).length).toBe(1);
  });

  it("caps the footer at the content width, not the body measure", () => {
    // The body measure (68ch, roughly 600px) is for prose. On a container it
    // squeezes eight links into a narrow ragged column — the reported symptom.
    const body = ruleFor(".pass-footer");
    expect(body).toContain("--layout-content-max");
    expect(body).not.toContain("--measure-body");
  });

  it("actually lays the footer out on a grid", () => {
    // `.pass-footer-grid` had NO rule at all, so the "grid" was a plain block
    // div: brand and links stacked with no gap at every width.
    const body = ruleFor(".pass-footer-grid");
    expect(body).toContain("display: grid");
    expect(body).toContain("grid-template-columns: 1fr");
  });

  /**
   * Every `@media (min-width: ...)` block that contains `selector`,
   * concatenated.
   *
   * Two deliberate choices. It scans ALL media blocks, not the first, because
   * components.css has a dozen and the footer's is not the first. And it takes
   * the breakpoint from the stylesheet rather than hard-coding one: a media
   * query breakpoint is legitimately a raw px value, so naming it in a test
   * would trip the token scan for a number that is not a design token.
   */
  function mediaBlocksFor(selector: string): string {
    const out: string[] = [];
    const re = /@media \(min-width: \d+px\)/g;
    let m = re.exec(css);
    while (m) {
      const open = css.indexOf("{", m.index);
      let depth = 0;
      let i = open;
      for (; i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        else if (css[i] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const block = css.slice(m.index, i + 1);
      if (block.includes(selector)) out.push(block);
      // Advance the regex past this block. Slicing the string and re-running
      // `exec` on the slice would make `m.index` slice-relative, and every
      // later `indexOf` would search from the top of the file.
      re.lastIndex = i + 1;
      m = re.exec(css);
    }
    return out.join("\n");
  }

  it("switches the footer to two columns at a wider breakpoint", () => {
    // A template that never changes cannot overflow-proof itself. One column at
    // mobile, two when there is room for a brand beside eight links.
    const tablet = mediaBlocksFor(".pass-footer-grid");
    expect(tablet).not.toBe("");
    expect(tablet).toMatch(/grid-template-columns: minmax\(0, 1fr\) auto/);
  });

  it("lets the link list wrap instead of overflowing", () => {
    expect(ruleFor(".pass-footer-links")).toContain("flex-wrap: wrap");
  });

  it("resets the link list, because there is no global ul reset", () => {
    // globals.css carries no `ul`/`ol` rule by design: apps/web is on the token
    // layer and resets are per-primitive. An unstyled <ul> paints discs and a
    // 40px indent straight into the footer.
    const body = ruleFor(".pass-footer-links");
    expect(body).toContain("list-style: none");
    expect(body).toMatch(/margin: 0/);
    expect(body).toMatch(/padding: 0/);
  });

  it("widens the footer gutter at the breakpoints the content does", () => {
    // The footer links must line up with the topbar nav above them. Asserted
    // as "the footer is re-gutted inside a media query", not by naming widths.
    expect(mediaBlocksFor(".pass-footer")).toMatch(
      /\.pass-footer \{[\s\S]{0,200}padding-inline/,
    );
  });

  it("widens the hero shell gutter at the same breakpoints", () => {
    // The gutter is now ONE custom property. The shell's padding, its negative
    // margin and the watermark's padding all read it, so the three cannot
    // drift apart at a breakpoint — which is exactly what the old
    // padding-inline-per-breakpoint arrangement allowed.
    const blocks = mediaBlocksFor(".pass-landing-shell");
    expect(blocks).not.toBe("");
    expect(blocks).toMatch(/--shell-gutter/);
    // The base rule declares it and uses it for both padding and margin.
    const base = ruleFor(".pass-landing-shell");
    expect(base).toMatch(/--shell-gutter:/);
    expect(base).toContain("padding-inline: var(--shell-gutter)");
    expect(base).toContain("margin-inline: calc(var(--shell-gutter) * -1)");
    // And the watermark reads the same property, not a literal margin token.
    const at = css.indexOf(".pass-landing-shell .pass-watermark");
    expect(at).toBeGreaterThan(-1);
    const open = css.indexOf("{", at);
    const body = css.slice(open + 1, css.indexOf("}", open));
    expect(body).toContain("padding-inline: var(--shell-gutter)");
  });

  it("gives the clipped hero shell padding, so the clip has something to spare", () => {
    // `.pass-wash` sets overflow: clip (§14.15 rule 4). On the hero that is
    // correct and necessary — but a zero-padding clip cuts the wash, the grain
    // and the ghost watermark flush on all four sides, which is why the hero
    // read as a cropped slab.
    const body = ruleFor(".pass-landing-shell");
    expect(body).toContain("padding-block");
    expect(body).toContain("padding-inline");
  });

  it("pulls the hero shell padding back out to the section gutter", () => {
    // The shell is a child of `.pass-shell-content`, which already carries the
    // gutter. Without the negative margin the two paddings stack and the hero
    // text sits inset from every other section's text.
    expect(ruleFor(".pass-landing-shell")).toMatch(/margin-inline: calc\(/);
  });

  it("caps the hero lede at the body measure", () => {
    // `.pass-landing-lede` had no rule either, so the one prose paragraph in
    // the hero ran the full 1280px — a line length no one can read.
    expect(ruleFor(".pass-landing-lede")).toContain("--measure-body");
  });

  it("leaves the wash, grain and watermark clipping intact", () => {
    // §14.15 is the reason the clip exists. The fix must not remove it, or the
    // overlay bug §14.15 rule 4 was written for comes straight back.
    const wash = ruleFor(".pass-wash");
    expect(wash).toContain("overflow: clip");
    expect(wash).toContain("isolation: isolate");
  });

  it("keeps the hero text above the grid field so the grid cannot overlap it", () => {
    const at = css.indexOf(".pass-landing-hero,");
    const open = css.indexOf("{", at);
    const close = css.indexOf("}", open);
    const body = css.slice(open + 1, close);
    expect(body).toContain("position: relative");
    expect(body).toMatch(/z-index: 1/);
  });
});
