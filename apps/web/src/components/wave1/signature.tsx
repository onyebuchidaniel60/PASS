/**
 * PASS Wave 1 — signature devices.
 *
 * design/DESIGN.md §9.2: Eyebrow, SectionNumber, SignalLine, Reticle,
 * CoordinatePair.
 *
 * These are the devices that make PASS read as an instrument rather than a feed
 * (§11). Two rules from the design document are load-bearing here and are easy
 * to get wrong:
 *
 *  - §2.5 / §3.4 The ember accent may mark the eyebrow delimiters and the
 *    signal line, and may NOT mark section headings. So the delimiters and the
 *    rule are accented; the label text itself is not.
 *  - §11.3 The three price levels are visually equal in weight and are never
 *    colour-coded good or bad. CoordinatePair therefore has no positive/negative
 *    variant, by design. Adding one would be a synthetic-trust anti-pattern
 *    (§12.3).
 */
import type { ReactNode } from "react";

export interface EyebrowProps {
  children: ReactNode;
  /**
   * Frames the label as `// LABEL \`. §3.4: the delimiters are the only place
   * the accent touches a heading. Defaults to true.
   */
  delimiter?: boolean;
  /** Optional `// 04 \` number at the opposite edge of the same row (§3.4). */
  number?: string | number;
  className?: string;
}

/** §9.2 / §3.4 Monospace, uppercase, tracked eyebrow. */
export function Eyebrow({ children, delimiter = true, number, className }: EyebrowProps) {
  return (
    <div className={["pass-eyebrow", className].filter(Boolean).join(" ")} data-delimiter={String(delimiter)}>
      <span>{children}</span>
      {number !== undefined ? <SectionNumber value={number} /> : null}
    </div>
  );
}

export interface SectionNumberProps {
  value: string | number;
  className?: string;
}

/**
 * §9.2 `// 04 \` at the opposite edge of the eyebrow row.
 *
 * Zero-padded to two digits because every section in §10 is numbered that way
 * and a ragged `4` next to `12` would read as inconsistent.
 */
export function SectionNumber({ value, className }: SectionNumberProps) {
  const text = typeof value === "number" ? String(value).padStart(2, "0") : value;
  return (
    <span className={["pass-section-number", className].filter(Boolean).join(" ")}>
      {`// ${text} \\`}
    </span>
  );
}

export interface SignalLineProps {
  /** Optional reticle node on the line. §7.2 `reticle`. */
  node?: ReactNode;
  /**
   * Reveals once on load at --duration-deliberate. §6.4. Hero only — gap G-13
   * forbids this sweep on an inner panel. Defaults to false so an inner panel
   * cannot animate by omission.
   */
  reveal?: boolean;
  className?: string;
}

/**
 * §9.2 Horizontal ember rule, the recurring device.
 *
 * The rule itself is decorative and carries no information, so the <hr> is
 * aria-hidden. The WRAPPER is deliberately not: §10.1 puts a `reticle` node on
 * the hero signal line, and §7.3 requires every glyph to have an accessible
 * name. Hiding the wrapper would hide that node's accessible name with it, which
 * is the defect a test caught the first time this was written.
 */
export function SignalLine({ node, reveal = false, className }: SignalLineProps) {
  return (
    <div
      className={["pass-signal-line", className].filter(Boolean).join(" ")}
      data-reveal={String(reveal)}
    >
      <hr aria-hidden="true" />
      {node}
    </div>
  );
}

export interface ReticleProps {
  /**
   * Required. §7.2 and §7.3: a glyph is never the only carrier of meaning, and
   * every icon-only control needs an accessible name. A reticle with no label
   * would be exactly the defect §7.3 forbids.
   */
  label: string;
  className?: string;
}

/**
 * §7.1 / §7.2 Precision crosshair: 20x20 grid, 1.5px stroke, square caps,
 * inheriting currentColor. §7.1 says icon colour is never hard-coded, so the
 * stroke uses `currentColor` and the accent comes from CSS.
 */
export function Reticle({ label, className }: ReticleProps) {
  return (
    <span
      className={["pass-reticle", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={label}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="10" cy="10" r="6" />
        <path d="M10 0v5M10 15v5M0 10h5M15 10h5" />
      </svg>
    </span>
  );
}

export interface CoordinatePairProps {
  /** Uppercase label, e.g. ENTRY. §9.2. */
  label: string;
  /**
   * The value, already formatted by the caller with the market's own decimal
   * count. §11.2: decimals are never chosen client-side, so this component must
   * not re-round or pad what it is given.
   */
  value: string;
  size?: "m" | "l";
  /** Full value for assistive technology when the visible one is truncated
   *  (§11.6). Omit when value is already complete. */
  fullValue?: string;
  className?: string;
}

/**
 * §9.2 / §11.3 A labelled monospace pair — PASS's precision motif.
 *
 * The visible value truncates with an ellipsis (§8.5) while the full value stays
 * available to assistive technology via `title` and the accessible name, so a
 * long address is never silently lost.
 *
 * There is deliberately no `tone` prop. §11.3 says the three price levels are
 * visually equal in weight and not colour-coded good or bad.
 */
export function CoordinatePair({
  label,
  value,
  size = "m",
  fullValue,
  className,
}: CoordinatePairProps) {
  return (
    <div
      className={["pass-coordinate-pair", className].filter(Boolean).join(" ")}
      data-size={size}
    >
      <span className="pass-coordinate-pair-label">{label}</span>
      <span className="pass-coordinate-pair-value" title={fullValue}>
        {value}
      </span>
    </div>
  );
}

export interface CoordinateGridProps {
  children: ReactNode;
  className?: string;
}

/** §9.2 / §11.3 The ENTRY / TP / SL / LEVERAGE grid. Equal weight throughout. */
export function CoordinateGrid({ children, className }: CoordinateGridProps) {
  return (
    <div className={["pass-coordinate-grid", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
