"use client";

/**
 * §14.5 data cards — the pattern the operator named by name ("missed details
 * and cards from the reference").
 *
 * The card is DARKER than the canvas around it. That inverts the usual
 * raised-panel assumption, and it is the single change that most separates
 * this from the Stage K `Panel`, which was `--color-surface` on `--color-canvas`
 * and therefore read as a slightly lighter rectangle.
 *
 * Every measurement here is a token. A value written here would be a literal,
 * and `scripts/check-design-tokens.mjs` fails the build on one.
 */

import type { ReactNode } from "react";

import { StatusBadge, type StatusTone } from "./markers";

export interface CardMetric {
  label: string;
  value: ReactNode;
}

export interface DataCardProps {
  /** `BTC LONG`, `PASS 7721`. The one accent in the header. */
  id: string;
  /** One muted line under the identifier: asset, direction, subtitle. */
  sub?: string;
  /**
   * The big figure. A NUMBER by default — set at --type-data-xl in the data
   * face, which is §14.5.4.
   *
   * Pass `prose` when the value is SENTENCES instead. A paragraph set at the
   * data-xl step is 2.5rem IBM Plex Mono, which overflows the card at every
   * width; that is not a guess, it is exactly what the `/help` topic cards were
   * doing before this prop existed.
   */
  value: ReactNode;
  /**
   * Declares that `value` is prose rather than a figure, and drops the value
   * slot to --type-body-m with a capped measure.
   *
   * This is a prop rather than a class the caller writes by hand on purpose:
   * `/help` had nine prose cards that each needed `className="pass-info-card"`
   * and did not have it, so all nine rendered a paragraph at 2.5rem. Forgetting
   * a class name is invisible; passing a boolean at the call site is a decision
   * on a line someone is already editing.
   */
  prose?: boolean;
  /** Unit suffix. Set on the SAME baseline as the value, never its own line. */
  unit?: string;
  /** Right-hand header slot: a `LiveDot`, a state word, nothing. */
  headerAside?: ReactNode;
  metrics?: CardMetric[];
  children?: ReactNode;
  status?: { tone: StatusTone; label: string };
  /** Full-width action. `href` renders a link, otherwise a button. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Wraps the whole card in a link. Makes the card a hit target. */
  interactive?: boolean;
  as?: "article" | "section" | "div";
  className?: string;
  labelledBy?: string;
}

export function DataCard({
  id,
  sub,
  value,
  prose = false,
  unit,
  headerAside,
  metrics = [],
  children,
  status,
  action,
  interactive = false,
  as: As = "article",
  className,
  labelledBy,
}: DataCardProps) {
  return (
    <As
      className={["pass-card", prose ? "pass-card-prose" : null, className]
        .filter(Boolean)
        .join(" ")}
      data-interactive={interactive ? "true" : undefined}
      data-prose={prose ? "true" : undefined}
      aria-labelledby={labelledBy}
    >
      <div className="pass-card-header">
        <span className="pass-card-id">{id}</span>
        {headerAside ? <span>{headerAside}</span> : null}
      </div>

      {sub ? <p className="pass-card-sub">{sub}</p> : null}

      <p className="pass-card-value">
        <span>{value}</span>
        {unit ? <span className="pass-card-value-unit">{unit}</span> : null}
      </p>

      {children}

      {metrics.length > 0 ? (
        <dl className="pass-card-metrics">
          {metrics.map((m) => (
            <div className="pass-card-metric" key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {status ? (
        <div className="pass-badge-status-row">
          <span className="pass-card-metric-label">Status</span>
          <StatusBadge tone={status.tone} label={status.label} variant="bare" />
        </div>
      ) : null}

      {action ? (
        action.href ? (
          <a className="pass-card-action" href={action.href}>
            <span>{action.label}</span>
            <span aria-hidden="true">{"\\u2197"}</span>
          </a>
        ) : (
          <button type="button" className="pass-card-action" onClick={action.onClick}>
            <span>{action.label}</span>
            <span aria-hidden="true">{"\\u2197"}</span>
          </button>
        )
      ) : null}
    </As>
  );
}

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  /**
   * Unit suffix, set on the SAME baseline as the value (§14.5.4) — never on its
   * own line, where it reads as a second value.
   *
   * Added on demand for §10.3's plan block: a metric card showing `$113.4K`
   * without `per ETH` is ambiguous about what is being priced, and the five
   * §11.3 figures are exactly the case where ambiguity matters.
   */
  unit?: string;
  /** Optional second line, muted. §14.5 stat card. */
  sub?: string;
  className?: string;
}

/**
 * One label, one value. The §14.5 metric card, and the only card type that
 * carries a live figure on its own — which is why it is laid out to five across
 * at 1440 by `auto-fit`, never by a hand-set column count.
 */
export function MetricCard({ label, value, unit, sub, className }: MetricCardProps) {
  return (
    <div className={["pass-metric-card", className].filter(Boolean).join(" ")}>
      <span className="pass-metric-card-label">{label}</span>
      <span className="pass-metric-card-value">
        {/* The figure gets its own element so CSS can keep the FIGURE unbreakable
  while letting the figure+unit PAIR wrap inside a narrow card. §14.5.4 wants
   the unit on the same baseline, which it still is whenever both fit. */}
 <span className="pass-metric-card-figure">{value}</span>
        {unit ? <span className="pass-metric-card-unit">{unit}</span> : null}
      </span>
      {sub ? <span className="pass-card-sub">{sub}</span> : null}
    </div>
  );
}

export function MetricCardRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={["pass-metric-cards", className].filter(Boolean).join(" ")}>{children}</div>
  );
}

export interface SparklineProps {
  /** Normalised series, oldest first. Values are scaled by the component. */
  points: number[];
  /** Line and fill colour. §11.4 governs which tone a change may carry. */
  tone?: "positive" | "negative" | "neutral";
  /** Required: a chart with no accessible name is a chart nobody can read. */
  label: string;
}

const VIEW_W = 100;
const VIEW_H = 32;

/**
 * §14.5.7 and §11.2. The only chart PASS has; G-3 forbids axes, labels,
 * gridlines, indicators or a terminal. No axes, no ticks, no tooltip.
 */
export function Sparkline({ points, tone = "neutral", label }: SparklineProps) {
  const usable = points.filter((n) => Number.isFinite(n));
  if (usable.length < 2) {
    // A single point has no direction. Rendering an empty axis would imply a
    // flat series that was never observed, so the slot collapses instead.
    return null;
  }

  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const span = max - min || 1;
  const step = VIEW_W / (usable.length - 1);

  const coords = usable.map(
    (n, i) => `${(i * step).toFixed(2)},${(VIEW_H - ((n - min) / span) * VIEW_H).toFixed(2)}`,
  );
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;

  return (
    <svg
      className="pass-sparkline"
      data-tone={tone}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path d={area} fill="currentColor" opacity="0.24" stroke="none" />
      <path d={line} />
    </svg>
  );
}
