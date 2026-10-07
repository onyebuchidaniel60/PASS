"use client";

/**
 * §14.10 the numbered step grid and §14.8 the ticker bar.
 *
 * The step grid is the reference's "How satellite verification Works" panel and
 * is used twice: shortened on the Landing page, in full on `/how-it-works`.
 * §14.10 forbids filling the visual slot with an image, so the slot takes a
 * data card or a stat row; that is a deliberate refusal, not an omission.
 *
 * The ticker has no marquee. It re-renders on each poll, because a scrolling
 * bar that never matches the data is a lie the reference does not tell.
 */

import type { ReactNode } from "react";

import { LiveDot } from "./markers";

export interface StepSpec {
  /** One-based position; rendered in an outlined circle, never filled. */
  step: number;
  title: string;
  body: string;
  /** A data card or stat row. NOT an image (§14.10). */
  visual?: ReactNode;
  /** Footer left: a reference value, e.g. a date or an id. */
  footLabel?: string;
  /** Footer right: a 14px ember glyph. */
  footIcon?: ReactNode;
}

export function StepGrid({ steps, className }: { steps: StepSpec[]; className?: string }) {
  return (
    <div className={["pass-steps", className].filter(Boolean).join(" ")}>
      {steps.map((s) => (
        <article className="pass-step" key={s.step}>
          <span className="pass-step-badge" aria-hidden="true">
            {String(s.step).padStart(2, "0")}
          </span>
          <h3 className="pass-step-title">{s.title}</h3>
          <p className="pass-step-body">{s.body}</p>
          {s.visual ? <div className="pass-step-visual">{s.visual}</div> : null}
          {s.footLabel || s.footIcon ? (
            <p className="pass-step-foot">
              <span className="pass-step-foot-label">{s.footLabel ?? ""}</span>
              {s.footIcon}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export interface TickerEntry {
  symbol: string;
  price: string;
  /** Signed percentage, e.g. `+2.41%`. §11.4 owns the tone. */
  change?: string;
  tone?: "positive" | "negative" | "neutral";
}

export interface TickerBarProps {
  entries: TickerEntry[];
  /**
   * When the market feed is unavailable the bar says so and shows nothing else.
   * It never renders empty: an empty bar reads as "no markets moved", which is
   * a different and wrong statement (§14.8).
   */
  unavailable?: boolean;
  label?: string;
}

export function TickerBar({ entries, unavailable = false, label = "Market prices" }: TickerBarProps) {
  if (unavailable || entries.length === 0) {
    return (
      <div className="pass-ticker" role="note" aria-label={`${label}: unavailable`}>
        <span className="pass-ticker-unavailable">Market data unavailable</span>
      </div>
    );
  }

  return (
    <div className="pass-ticker" aria-label={label}>
      {entries.map((e) => (
        <span className="pass-ticker-entry" key={e.symbol}>
          <span className="pass-ticker-symbol">{e.symbol}</span>
          <span className="pass-ticker-price">{e.price}</span>
          {e.change ? (
            <span className="pass-ticker-delta" data-tone={e.tone ?? "neutral"}>
              {e.change}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export interface DenseRowProps {
  label: ReactNode;
  value: ReactNode;
  /** The reference marks a selected row with a 2px ember LEFT border (§14.11). */
  selected?: boolean;
  className?: string;
}

/** §14.11. 34px floor, mono, right-aligned figures, hairline separator. */
export function DenseRow({ label, value, selected = false, className }: DenseRowProps) {
  return (
    <div
      className={["pass-dense-row", selected ? "pass-dense-selected" : null, className]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <span className="pass-card-metric dd">{value}</span>
    </div>
  );
}

export function DenseHead({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="pass-dense-head">
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

export { LiveDot };
