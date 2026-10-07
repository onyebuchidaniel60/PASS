"use client";

/**
 * §14.3 numbered eyebrows and §14.4 display headlines.
 *
 * These two are together because they are the reference's two loudest devices
 * and both were entirely absent from the Stage K build:
 *
 *  - every reference section opens with `\\  NAME  \\` ....... `\\  07  \\`;
 *  - every reference headline is roughly twice the size the Stage K build used,
 *    at display weight, split across authored lines, with ONE ember word per
 *    line.
 *
 * `DisplayHeadline` takes lines and words as data rather than as children
 * precisely so the line breaks and the accent word cannot be left to the
 * browser. A hero that wraps to five lines at 375px is a layout failure, and it
 * is a failure that only appears at the one breakpoint nobody tests.
 */

import type { ReactNode } from "react";

import type { HeadlineWord } from "@/lib/hero-copy";

export interface NumberedEyebrowProps {
  /** The section name. Uppercased by CSS; write it as words. */
  label: string;
  /** Two-digit position. Written out so it reads in greyscale (§9.4). */
  number?: string | number;
  className?: string;
}

/** `\\  SECTION NAME  \\` on the left, `\\  07  \\` hard right. */
export function NumberedEyebrow({ label, number, className }: NumberedEyebrowProps) {
  return (
    <p className={["pass-numbered-eyebrow", className].filter(Boolean).join(" ")}>
      <span className="pass-numbered-eyebrow-label">
        <span className="pass-numbered-eyebrow-delim" aria-hidden="true">
          {"\\"}
        </span>
        <span>{label}</span>
        <span className="pass-numbered-eyebrow-delim" aria-hidden="true">
          {"\\"}
        </span>
      </span>
      {number !== undefined ? (
        <span className="pass-numbered-eyebrow-number">
          <span className="pass-numbered-eyebrow-delim" aria-hidden="true">
            {"\\"}
          </span>
          <span>{String(number).padStart(2, "0")}</span>
          <span className="pass-numbered-eyebrow-delim" aria-hidden="true">
            {"\\"}
          </span>
        </span>
      ) : null}
    </p>
  );
}

/**
 * The dot variant, for a section whose content changes rather than one that is
 * merely positioned (§14.3). Never used with a number: a position and a liveness
 * cue are different claims.
 */
export function DotEyebrow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <p className="pass-dot-eyebrow">
      <span className="pass-live-dot" aria-hidden="true" />
      <span>{label}</span>
      {children}
    </p>
  );
}

export interface DisplayHeadlineProps {
  /** Authored line breaks. Never inferred. */
  lines: HeadlineWord[][];
  /** The horizontal gradient treatment. Landing hero only (§14.4). */
  gradient?: boolean;
  /** Renders at the §14.4 section step rather than the hero step. */
  section?: boolean;
  className?: string;
  /** Overrides the element; a hero is an `h1`, a section headline is an `h2`. */
  as?: "h1" | "h2" | "h3" | "p";
}

export function DisplayHeadline({
  lines,
  gradient = false,
  section = false,
  className,
  as: As = "h1",
}: DisplayHeadlineProps) {
  // The accessible name is computed from the SAME `lines` data that renders the
  // visible words, so the two cannot drift. It is set explicitly because each
  // line is its own block-level span: without it, name computation concatenates
  // the lines with no separator and a screen reader says
  // "See a trade.Know the trader.Take the trade." — three sentences run into one
  // word. That is a real defect, not a test artefact, and it is invisible to
  // anyone reading the rendered page.
  const accessibleName = lines
    .map((line) => line.map((w) => w.text).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <As
      className={[
        section ? "pass-section-display" : "pass-display",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-gradient={gradient ? "true" : undefined}
      aria-label={accessibleName}
    >
      {lines.map((line, i) => (
        // The index is the identity here on purpose: these lines are authored
        // constants that never reorder, and a content-derived key would be
        // longer than the content.
        <span className="pass-display-line" key={`line-${i}`}>
          {line.map((word, j) => (
            <span
              className={word.accent ? "pass-display-accent" : undefined}
              key={`word-${i}-${j}`}
            >
              {word.text}
              {j < line.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      ))}
    </As>
  );
}

/**
 * The §14.4 copy table lives in `@/lib/hero-copy`, NOT here, and the reason
 * matters: this module is `"use client"`, and a Server Component importing a
 * plain VALUE from a client module receives a client-reference proxy rather
 * than the value. `HERO_LINES.landing` is then `undefined` at prerender and
 * `next build` throws `Cannot read properties of undefined (reading 'map')` —
 * a failure that appears ONLY in the build and never in a DOM test.
 *
 * Re-exported here for CLIENT consumers. Server Components must import from
 * `@/lib/hero-copy` directly.
 */
export { HERO_LINES, heroLines, type HeadlineWord } from "@/lib/hero-copy";
