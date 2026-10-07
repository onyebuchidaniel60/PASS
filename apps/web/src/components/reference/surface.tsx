"use client";

/**
 * §14.1 background primitives.
 *
 * These four exist because the Stage K build rendered every surface as a flat
 * `--color-canvas` fill and the operator reported the result as "too generic".
 * The reference set is never flat: there is a radial ember wash behind hero
 * content and a fine grain over everything.
 *
 * `Surface` is the composition and is what screens should use. The other three
 * are exported because a screen occasionally needs one layer without the others
 * (a section that wants grain but no wash, per §14.1's flat rule).
 *
 * The wash and the grain are `position: absolute` inside a `position: relative`
 * shell that clips. This is not a style preference: an unclipped absolute wash
 * escapes its shell and paints over the next section, which is precisely the
 * operator's "overflows and overlay on other elements" report (§14.15 rule 4).
 * `isolation: isolate` keeps the grain's `mix-blend-mode: overlay` blending
 * against this surface only, never against whatever is behind it.
 */

import type { ElementType, ReactNode } from "react";

export type WashStrength = "hero" | "section" | "tight" | "flat";

export interface SurfaceProps {
  children: ReactNode;
  /**
   * `hero` — full strength, behind a hero. `section` — reduced, behind a
   * section header where a hero-strength core would compete with the headline
   * sitting on it. `tight` — the bright device/wordmark hero only. `flat` —
   * NO wash; grain only, which is what §14.1 requires on every data-heavy
   * surface (Executions, My Passes, the Take preview, Settings).
   */
  strength?: WashStrength;
  /** Grain over the wash. On by default; §14.13.1 makes it part of "alive". */
  grain?: boolean;
  /** Oversized brand type at 5% behind hero content (§14.1). */
  watermark?: string;
  as?: ElementType;
  className?: string;
  /** Forwarded to the rendered element, e.g. `aria-labelledby`. */
  labelledBy?: string;
}

export function GradientWash({ strength = "hero" }: { strength?: WashStrength }) {
  return <span className="pass-wash-layer" aria-hidden="true" data-strength={strength} />;
}

export function NoiseOverlay() {
  return <span className="pass-grain" aria-hidden="true" />;
}

export function Watermark({ text }: { text: string }) {
  return (
    <span className="pass-watermark" aria-hidden="true">
      {text}
    </span>
  );
}

export function Surface({
  children,
  strength = "hero",
  grain = true,
  watermark,
  as: As = "div",
  className,
  labelledBy,
}: SurfaceProps) {
  return (
    <As
      className={["pass-wash", className].filter(Boolean).join(" ")}
      data-strength={strength}
      aria-labelledby={labelledBy}
    >
      <GradientWash strength={strength} />
      {grain ? <NoiseOverlay /> : null}
      {watermark ? <Watermark text={watermark} /> : null}
      {children}
    </As>
  );
}
