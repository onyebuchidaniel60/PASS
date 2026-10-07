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

export interface HeadlineWord {
  text: string;
  /** The one ember word on this line (§14.4). */
  accent?: boolean;
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
  return (
    <As
      className={[
        section ? "pass-section-display" : "pass-display",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-gradient={gradient ? "true" : undefined}
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

/** The §14.4 copy table, as data. Screens import these rather than retyping. */
export const HERO_LINES = {
  landing: [
    [{ text: "See" }, { text: "a" }, { text: "trade.", accent: true }],
    [{ text: "Know" }, { text: "the" }, { text: "trader." }],
    [{ text: "Take" }, { text: "the" }, { text: "trade." }],
  ],
  discover: [
    [{ text: "Live" }, { text: "plans,", accent: true }],
    [{ text: "written" }, { text: "by" }, { text: "traders." }],
  ],
  take: [
    [{ text: "You" }, { text: "author" }],
    [{ text: "your" }, { text: "own", accent: true }, { text: "size." }],
  ],
  howItWorks: [
    [{ text: "A" }, { text: "Pass", accent: true }, { text: "is" }],
    [{ text: "a" }, { text: "plan," }, { text: "not" }, { text: "a" }, { text: "promise." }],
  ],
} as const;
