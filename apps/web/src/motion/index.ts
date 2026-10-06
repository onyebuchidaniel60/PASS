/**
 * PASS motion helpers.
 *
 * design/FRONTEND_IMPLEMENTATION_PLAN.md §5: durations and easings live in the
 * token layer, animation BEHAVIOUR lives in this module, and components call
 * helpers. A component that reaches for an animation library directly is a
 * defect even when it looks right, and `scripts/check-design-tokens.mjs`
 * rejects that import mechanically.
 *
 * No animation library is installed. Nothing here loops, nothing exceeds
 * --duration-deliberate (420ms), and every animation carries one of the three
 * purposes defined in design/DESIGN.md §6.1. Motion that only decorates is not
 * implemented at all.
 *
 * Reduced motion (DESIGN.md §6.6): every helper collapses to instant or
 * fade-only. The switch is read in ONE place, `prefersReducedMotion()`, and
 * every helper honours it, so no component can forget to check. Transform-based
 * motion is REMOVED under reduced motion, not shortened; opacity cross-fades
 * are retained but capped at --duration-fast.
 */

/** The three permitted purposes. Motion that fits none of them is not built. */
export type MotionPurpose = "orient" | "confirm" | "explain";

/**
 * Reads the OS reduced-motion setting.
 *
 * The single place it is read. Returns false in a non-DOM environment so a
 * helper is never silently disabled by an absent API.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Token names rather than values.
 *
 * Values are resolved by the browser from the token layer, so no duration or
 * easing literal appears in this module. This is what makes the reduced-motion
 * override in tokens.css work: overriding a token changes every consumer,
 * including these helpers, without a single line changing here.
 */
const DURATION = {
  instant: "var(--duration-instant)",
  fast: "var(--duration-fast)",
  base: "var(--duration-base)",
  slow: "var(--duration-slow)",
  deliberate: "var(--duration-deliberate)",
} as const;

const EASE = {
  standard: "var(--ease-standard)",
  exit: "var(--ease-exit)",
  linear: "var(--ease-linear)",
} as const;

export type DurationName = keyof typeof DURATION;
export type EaseName = keyof typeof EASE;

export interface MotionSpec {
  /** One-line statement of what this animation is FOR. Recorded, not inferred. */
  readonly purpose: MotionPurpose;
  readonly duration: DurationName;
  readonly easing: EaseName;
  /**
   * Transform or opacity-only. Under reduced motion a transform-based spec
   * collapses to instant; an opacity-only spec fades at --duration-fast.
   */
  readonly kind: "transform" | "opacity";
}

/** The motion inventory, one entry per row of DESIGN.md §6.4. */
export const MOTION = {
  /** orient — route change: opacity 0 -> 1, translateY 8px -> 0. */
  routeEnter: {
    purpose: "orient",
    duration: "slow",
    easing: "standard",
    kind: "transform",
  },
  /** orient — drawer / bottom sheet: translate from the edge plus opacity. */
  sheetEnter: {
    purpose: "orient",
    duration: "slow",
    easing: "exit",
    kind: "transform",
  },
  /** orient — collapsible section: grid-template-rows 0fr -> 1fr plus opacity. */
  disclosure: {
    purpose: "orient",
    duration: "base",
    easing: "standard",
    kind: "transform",
  },
  /**
   * orient — hero signal line reveal, ONCE. DESIGN.md §6.4 and gap G-13: this
   * sweep exists on the hero only and must never be applied to an inner panel.
   */
  signalLineReveal: {
    purpose: "orient",
    duration: "deliberate",
    easing: "standard",
    kind: "transform",
  },
  /** confirm — primary CTA press: scale 1 -> 0.98. */
  press: {
    purpose: "confirm",
    duration: "fast",
    easing: "standard",
    kind: "transform",
  },
  /** confirm — Take Pass accepted: opacity pulse on the CTA label plus one edge sweep. */
  accepted: {
    purpose: "confirm",
    duration: "base",
    easing: "standard",
    kind: "opacity",
  },
  /** confirm — copy to clipboard: icon swap, no movement. */
  copied: {
    purpose: "confirm",
    duration: "fast",
    easing: "linear",
    kind: "opacity",
  },
  /** explain — lifecycle state advance: cross-fade, no slide. */
  stateChange: {
    purpose: "confirm" as MotionPurpose,
    duration: "base",
    easing: "standard",
    kind: "opacity",
  },
  /** explain — loading to content: cross-fade only. */
  contentIn: {
    purpose: "explain",
    duration: "base",
    easing: "standard",
    kind: "opacity",
  },
  /** explain — inline validation message: opacity plus translateY -4px -> 0. */
  validation: {
    purpose: "explain",
    duration: "fast",
    easing: "standard",
    kind: "transform",
  },
} as const satisfies Record<string, MotionSpec>;

export type MotionName = keyof typeof MOTION;

/**
 * Resolves a spec to the CSS a component should apply.
 *
 * Under reduced motion: a transform-based animation is removed entirely, which
 * is why the returned `animation` is the empty string rather than a zero
 * duration. An opacity-only animation is retained but capped at
 * --duration-fast, per DESIGN.md §6.6.
 */
export function cssFor(
  name: MotionName,
): { animation: string; duration: string; easing: string } {
  const spec = MOTION[name];
  const reduced = prefersReducedMotion();

  if (reduced && spec.kind === "transform") {
    return { animation: "", duration: DURATION.instant, easing: EASE.standard };
  }

  const duration = reduced ? DURATION.fast : DURATION[spec.duration];
  const easing = EASE[spec.easing];
  return {
    animation: `var(--motion-${name})`,
    duration,
    easing,
  };
}

/**
 * Builds the `transition` shorthand for a press.
 *
 * Separate from `cssFor` because press feedback is part of the component
 * contract and is defined ONCE here rather than re-authored per component
 * (DESIGN.md §6.5).
 */
export function pressTransition(property = "transform"): string {
  const spec = MOTION.press;
  const duration = prefersReducedMotion() ? DURATION.fast : DURATION[spec.duration];
  return `${property} ${duration} ${EASE[spec.easing]}`;
}

/**
 * Transition for a data figure. --ease-linear only, per DESIGN.md §6.3: linear
 * is for data, so a count-up or progress fill does not appear to accelerate.
 */
export function dataTransition(property = "width"): string {
  const spec = MOTION.contentIn;
  const duration = prefersReducedMotion() ? DURATION.fast : DURATION[spec.duration];
  return `${property} ${duration} ${EASE.linear}`;
}

/**
 * CSS that collapses motion for a subtree, for surfaces that need to PREVIEW the
 * reduced-motion state rather than respond to the OS setting.
 *
 * Lives here, not in a component, because plan §2.2 permits a duration literal
 * in the motion helper module and nowhere else.
 *
 * This exists because faking `matchMedia` only fools code that READS matchMedia.
 * The `@media (prefers-reduced-motion: reduce)` rules in styles/components.css are
 * evaluated by the browser's CSS engine, which no JS override can reach — so the
 * gallery's first reduced-motion toggle was theatre: it flipped the JS switch and
 * left every reduced-motion CSS rule inactive. Found by inspecting the built
 * output, not by reading the code.
 *
 * Applied via a document attribute so the browser's own cascade evaluates it.
 */
export function reducedMotionPreviewCss(attribute = "data-pass-reduced-motion"): string {
  return `
[${attribute}="true"] .pass-signal-line[data-reveal="true"] > hr {
  animation: none;
  transform: none;
}
[${attribute}="true"] *,
[${attribute}="true"] *::before,
[${attribute}="true"] *::after {
  transition-duration: 0ms;
  animation-duration: 0ms;
  animation-iteration-count: 1;
}
`;
}
