import {
  MOTION,
  cssFor,
  dataTransition,
  pressTransition,
  prefersReducedMotion,
  type MotionName,
} from "./index";

/**
 * Motion helper tests.
 *
 * The reduced-motion assertions are the substance here. DESIGN.md §6.6 says a
 * screen that only works with motion on is not done, and the known failure
 * (SKILL_FRONTEND_DESIGN.md §12) is that a spec is satisfied on paper while the
 * reduced path throws or silently keeps the motion. So each transform-based
 * spec is asserted to collapse, and each opacity spec to be capped.
 */

/** Sets the OS reduced-motion preference for one test. */
function setReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: reduced && query.includes("reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

afterEach(() => setReducedMotion(false));

describe("prefersReducedMotion", () => {
  it("is false when the OS setting is off", () => {
    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is true when the OS setting is on", () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe("motion inventory", () => {
  const names = Object.keys(MOTION) as MotionName[];

  it("every spec declares one of the three permitted purposes", () => {
    for (const name of names) {
      expect(["orient", "confirm", "explain"]).toContain(MOTION[name].purpose);
    }
  });

  it("uses only token-backed durations and easings, never literals", () => {
    // A literal duration here would be an out-of-token value and would also
    // bypass the reduced-motion override in tokens.css.
    for (const name of names) {
      const resolved = cssFor(name);
      expect(resolved.duration).toMatch(/^var\(--duration-/);
      expect(resolved.easing).toMatch(/^var\(--ease-/);
    }
  });

  it("never exceeds the deliberate cap of 420ms", () => {
    for (const name of names) {
      const spec = MOTION[name];
      const ms: Record<string, number> = {
        instant: 0,
        fast: 120,
        base: 180,
        slow: 260,
        deliberate: 420,
      };
      expect(ms[spec.duration]).toBeLessThanOrEqual(420);
    }
  });

  it("keeps the hero signal-line sweep on the deliberate duration only", () => {
    // DESIGN.md gap G-13: the sweep is a hero device and must not be reused on
    // an inner panel, so only this spec may carry the cap.
    const deliberate = names.filter((n) => MOTION[n].duration === "deliberate");
    expect(deliberate).toEqual(["signalLineReveal"]);
  });
});

describe("reduced motion (DESIGN.md 6.6)", () => {
  it("removes transform-based animation entirely rather than shortening it", () => {
    setReducedMotion(true);
    const transforms = (Object.keys(MOTION) as MotionName[]).filter(
      (n) => MOTION[n].kind === "transform",
    );
    expect(transforms.length).toBeGreaterThan(0);
    for (const name of transforms) {
      // DESIGN.md 6.6: transform animations are REMOVED, not shortened.
      expect(cssFor(name).animation).toBe("");
      expect(cssFor(name).duration).toBe("var(--duration-instant)");
    }
  });

  it("retains opacity cross-fades but caps them at duration-fast", () => {
    setReducedMotion(true);
    const opacities = (Object.keys(MOTION) as MotionName[]).filter(
      (n) => MOTION[n].kind === "opacity",
    );
    expect(opacities.length).toBeGreaterThan(0);
    for (const name of opacities) {
      expect(cssFor(name).duration).toBe("var(--duration-fast)");
    }
  });

  it("collapses press feedback to duration-fast", () => {
    setReducedMotion(false);
    expect(pressTransition()).toContain("var(--duration-fast)");
    setReducedMotion(true);
    expect(pressTransition()).toContain("var(--duration-fast)");
  });

  it("keeps data transitions on linear easing under reduced motion", () => {
    setReducedMotion(true);
    expect(dataTransition("width")).toContain("var(--ease-linear)");
  });
});

describe("non-reduced path", () => {
  it("applies the spec's own duration when motion is allowed", () => {
    setReducedMotion(false);
    expect(cssFor("routeEnter").duration).toBe("var(--duration-slow)");
    expect(cssFor("contentIn").duration).toBe("var(--duration-base)");
    expect(cssFor("validation").duration).toBe("var(--duration-fast)");
  });

  it("gives a transform spec a resolvable animation name when motion is allowed", () => {
    setReducedMotion(false);
    expect(cssFor("press").animation).toBe("var(--motion-press)");
  });
});
