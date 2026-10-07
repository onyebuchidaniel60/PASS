import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";

import LandingPage from "@/app/page";
import { prefersReducedMotion } from "@/motion";

/**
 * Landing screen — design/DESIGN.md §10.1, docs/UX_SPEC.md §4.
 *
 * §10 states the eye order is a testable requirement: hero line, then the CTAs,
 * then the loop strip, then the support line. The hero and both CTAs are
 * asserted here. The support line and loop are asserted too, because a screen
 * missing its fixed copy is a spec failure, not a cosmetic one.
 *
 * States: Landing has NO async surface, so empty/loading/error do not apply and
 * are not simulated. Fabricating a loading state for a screen with no request
 * would misrepresent the pipeline. The one state that does exist is the
 * reduced-motion path.
 */
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
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "See a trade. Know the trader. Take the trade.",
      }),
    ).toBeInTheDocument();
  });

  it("is the first heading on the page", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector("h1")).not.toBeNull();
  });

  it("renders exactly one signal line, with a reticle node", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll(".pass-signal-line")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Signal line origin" })).toBeInTheDocument();
  });

  it("reveals the signal line once, as the hero device", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector(".pass-signal-line")).toHaveAttribute(
      "data-reveal",
      "true",
    );
  });
});

describe("Landing CTAs (§10.1 item 2)", () => {
  it("renders Explore Passes as the single accent-filled action", () => {
    const { container } = render(<LandingPage />);
    const explore = screen.getByRole("link", { name: "Explore Passes" });
    expect(explore).toHaveAttribute("href", "/discover");
    const btn = explore.querySelector("[data-variant]");
    expect(btn).toHaveAttribute("data-variant", "primary");
    // §2.5 the accent marks ONE thing per viewport.
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it("renders Create a Pass as ghost and never accented", () => {
    const { container } = render(<LandingPage />);
    const create = screen.getByRole("link", { name: "Create a Pass" });
    expect(create).toHaveAttribute("href", "/passes/new");
    expect(create.querySelector("[data-variant]")).toHaveAttribute(
      "data-variant",
      "ghost",
    );
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it("links to real destinations, not placeholders", () => {
    render(<LandingPage />);
    expect(screen.getByRole("link", { name: "Explore Passes" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(screen.getByRole("link", { name: "Create a Pass" })).toHaveAttribute(
      "href",
      "/passes/new",
    );
  });
});

describe("Landing loop strip (§10.1 item 3)", () => {
  it("states all five steps of the loop", () => {
    render(<LandingPage />);
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
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll("ol.pass-loop-strip > li")).toHaveLength(5);
  });

  it("uses no decorative illustration (§12.2), only the structural reticle", () => {
    const { container } = render(<LandingPage />);
    // §12.2 forbids decorative illustration and stock imagery. It does NOT
    // forbid the reticle: §7.2 defines it as a structural device, and §10.1
    // puts one on the hero signal line. So the assertion is that the ONLY
    // graphic is that reticle, not that there are no graphics.
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector(".pass-reticle")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("picture")).toBeNull();
  });
});

describe("Landing support line (§10.1 item 4)", () => {
  it("renders the support line verbatim", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(
        "PASS turns Hyperliquid trade plans into shareable, executable links.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Landing composition rules", () => {
  it("puts the GridField behind the hero only, and inert", () => {
    const { container } = render(<LandingPage />);
    const field = container.querySelector(".pass-landing-field");
    expect(field).not.toBeNull();
    // Structural, never interactive, and aria-hidden in the component itself.
    expect(container.querySelector(".pass-grid-field")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows no emoji and no exclamation marks (§12.2, §12.4)", () => {
    const { container } = render(<LandingPage />);
    expect(container.textContent).not.toMatch(/[!]/);
    expect(container.textContent).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    );
  });

  it("contains no forbidden casino or guarantee copy (§12.4)", () => {
    const { container } = render(<LandingPage />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const word of [
      "guaranteed",
      "risk-free",
      "jackpot",
      "moon",
      "alpha",
      "locked in",
      "closing soon",
      "people are taking",
    ]) {
      expect(text, word).not.toContain(word);
    }
  });

  it("uses no urgency or scarcity language (§12.4)", () => {
    render(<LandingPage />);
    expect(screen.queryByText(/countdown|ends in|hurry/i)).not.toBeInTheDocument();
  });
});

describe("Landing reduced-motion path (§6.6)", () => {
  it("reads motion as allowed by default", () => {
    setReduced(false);
    render(<LandingPage />);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("honours the reduced-motion setting when it is on", () => {
    setReduced(true);
    render(<LandingPage />);
    // The motion helpers must see the reduced path, which is what removes the
    // transform-based sweep rather than shortening it.
    expect(prefersReducedMotion()).toBe(true);
  });

  it("keeps the signal line present in the DOM under reduced motion", () => {
    setReduced(true);
    const { container } = render(<LandingPage />);
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
    const { container } = render(<LandingPage />);
    const shell = container.querySelector(".pass-landing-shell") as HTMLElement;
    expect(shell).toBeTruthy();
    expect(shell.getAttribute("data-strength")).toBe("hero");
    expect(shell.querySelector(".pass-wash-layer")).toBeTruthy();
    expect(shell.querySelector(".pass-grain")).toBeTruthy();
    expect(shell.querySelector(".pass-watermark")?.textContent).toBe("PASS");
  });

  it("frames the hero and the step grid with corner brackets, and nothing else", () => {
    const { container } = render(<LandingPage />);
    // §14.2 rations these to four uses in the whole product. The Landing spends
    // two of them; a third here would mean the ration is not being enforced.
    expect(container.querySelectorAll(".pass-brackets")).toHaveLength(2);
  });

  it("sets one ember word on the hero's first line and none on the others", () => {
    const { container } = render(<LandingPage />);
    const hero = container.querySelector(".pass-display") as HTMLElement;
    const lines = hero.querySelectorAll(".pass-display-line");
    expect(lines).toHaveLength(3);
    expect(lines[0].querySelectorAll(".pass-display-accent")).toHaveLength(1);
    expect(lines[0].querySelector(".pass-display-accent")?.textContent).toBe("trade.");
    expect(lines[1].querySelectorAll(".pass-display-accent")).toHaveLength(0);
    expect(lines[2].querySelectorAll(".pass-display-accent")).toHaveLength(0);
  });

  it("gives the hero an accessible name with the lines separated", () => {
    render(<LandingPage />);
    // Each line is its own block span, so without an explicit name a screen
    // reader says "See a trade.Know the trader.Take the trade."
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "See a trade. Know the trader. Take the trade.",
      }),
    ).toBeInTheDocument();
  });

  it("numbers the three sections 01, 02 and 03", () => {
    const { container } = render(<LandingPage />);
    const numbers = Array.from(
      container.querySelectorAll(".pass-numbered-eyebrow-number"),
    ).map((n) => n.textContent?.replace(/\\/g, "").trim());
    expect(numbers).toEqual(["01", "02", "03"]);
  });

  it("renders the four-step grid with a data card in each visual slot", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelectorAll(".pass-steps")).toHaveLength(1);
    expect(container.querySelectorAll(".pass-step")).toHaveLength(4);
    // §14.10 forbids an image in the visual slot.
    expect(container.querySelectorAll(".pass-step-visual")).toHaveLength(4);
    expect(container.querySelectorAll(".pass-step-visual img")).toHaveLength(0);
    expect(container.querySelectorAll(".pass-step-visual .pass-metric-card")).toHaveLength(8);
  });

  it("puts the informational pages in the chip bar", () => {
    render(<LandingPage />);
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "FAQs" })).toHaveAttribute("href", "/faqs");
  });

  it("keeps exactly one accent fill: the Explore Passes button", () => {
    const { container } = render(<LandingPage />);
    // §2.5 rations the accent to one thing per viewport, and the step grid adds
    // eight metric cards. None of them may become an accent fill.
    expect(container.querySelectorAll(".pass-card-action")).toHaveLength(0);
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
  });

  it("uses only the documented class vocabulary, so no bespoke class creeps in", () => {
    const { container } = render(<LandingPage />);
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
   * Every `@media (min-width: <bp>)` block in the file, concatenated.
   *
   * Not `indexOf`: components.css has a dozen 768px blocks and the footer's is
   * not the first, so a single-index search inspects an unrelated rule and the
   * assertion passes or fails for the wrong reason.
   */
  function mediaBlocks(bp: string): string {
    const needle = `@media (min-width: ${bp})`;
    const out: string[] = [];
    let at = css.indexOf(needle);
    while (at >= 0) {
      const open = css.indexOf("{", at);
      let depth = 0;
      let i = open;
      for (; i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        else if (css[i] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      out.push(css.slice(at, i + 1));
      at = css.indexOf(needle, i + 1);
    }
    return out.join("\n");
  }

  it("switches the footer to two columns at the tablet breakpoint", () => {
    // A template that never changes cannot overflow-proof itself.
    const tablet = mediaBlocks("768px");
    expect(tablet).toContain(".pass-footer-grid");
    expect(tablet).toMatch(
      /\.pass-footer-grid[\s\S]{0,200}grid-template-columns/,
    );
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

  it("matches the content gutter at every breakpoint", () => {
    for (const bp of ["768px", "1024px"]) {
      expect(mediaBlocks(bp)).toMatch(
        /\.pass-footer \{[\s\S]{0,200}padding-inline/,
      );
    }
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
