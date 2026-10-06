/**
 * PASS Wave 3/4 data + identity primitives.
 *
 * design/DESIGN.md §11.7 StatusChip, §11.4 PnL, §9.5 data display, §9.6
 * identity and reputation, §9.7 state blocks.
 *
 * The rule this file exists to enforce: PASS performance and Hyperliquid
 * account performance are separate data categories and are never merged into one
 * figure or one label (D-014, PRD §13); Ethos reputation is never merged with
 * trading performance into a trust score (D-007, PRD §12). So ReputationBlock
 * and PerformanceBlock have no prop that could combine them, and each names its
 * own source.
 */

export type PassLifecycle =
  | "draft"
  | "active"
  | "entry_pending"
  | "open"
  | "tp_hit"
  | "sl_hit"
  | "manually_closed"
  | "expired"
  | "cancelled"
  | "invalidated";

/** §11.7 label per state. The text is what guarantees the state is unambiguous. */
export const LIFECYCLE_LABEL: Record<PassLifecycle, string> = {
  draft: "Draft",
  active: "Active",
  entry_pending: "Entry Pending",
  open: "Open",
  tp_hit: "TP Hit",
  sl_hit: "SL Hit",
  manually_closed: "Manually Closed",
  expired: "Expired",
  cancelled: "Cancelled",
  invalidated: "Invalidated",
};

export interface StatusChipProps {
  state: PassLifecycle;
  className?: string;
}

/** §11.7 Uppercase mono chip. Colour is secondary; the label is the meaning. */
export function StatusChip({ state, className }: StatusChipProps) {
  return (
    <span
      className={["pass-chip", className].filter(Boolean).join(" ")}
      data-state={state}
    >
      {LIFECYCLE_LABEL[state]}
    </span>
  );
}

export interface TimestampProps {
  /** ISO-8601 UTC. */
  value: string;
  /** e.g. "2h ago". Secondary and tertiary per §11.5. */
  relative?: string;
  className?: string;
}

/**
 * §11.5 Absolute mono UTC with the zone stated, plus an optional relative hint.
 * The absolute form never replaces itself with the relative one.
 */
export function Timestamp({ value, relative, className }: TimestampProps) {
  const when = new Date(value);
  const valid = !Number.isNaN(when.getTime());
  const absolute = valid
    ? `${when.toISOString().slice(0, 16).replace("T", " ")} UTC`
    : "—";
  return (
    <span className={["pass-value", className].filter(Boolean).join(" ")}>
      {absolute}
      {relative ? (
        <span className="pass-stale" style={{ marginInlineStart: "var(--space-2)" }}>
          {relative}
        </span>
      ) : null}
    </span>
  );
}

export interface LiveOrStaleProps {
  /** When the figure was read, ISO-8601 UTC. */
  observedAt: string;
  /** Freshness threshold in minutes; older than this renders STALE. */
  staleAfterMinutes?: number;
}

/**
 * §2.8 Live/stale carries a text label AND a timestamp. Colour is never the
 * only carrier.
 */
export function LiveOrStale({ observedAt, staleAfterMinutes = 5 }: LiveOrStaleProps) {
  const ageMin = Math.floor((Date.now() - new Date(observedAt).getTime()) / 60_000);
  const stale = !Number.isFinite(ageMin) || ageMin > staleAfterMinutes;
  return (
    <span className="pass-stale">
      <span className={stale ? undefined : "pass-live"}>{stale ? "Stale" : "Live"}</span>
      <span aria-hidden="true">·</span>
      <span>{ageMin >= 0 ? `${ageMin}m ago` : "just now"}</span>
    </span>
  );
}

export interface AddressProps {
  value: string;
  /** §11.6 four leading, four trailing. */
  lead?: number;
  trail?: number;
}

/**
 * §11.6 Truncated mono with the FULL value available to assistive technology
 * and on copy/expand. 4 and 4, per the design document.
 */
export function Address({ value, lead = 4, trail = 4 }: AddressProps) {
  const short =
    value.length > lead + trail + 1
      ? `${value.slice(0, lead)}…${value.slice(-trail)}`
      : value;
  return (
    <span className="pass-value" title={value} aria-label={value}>
      {short}
    </span>
  );
}

export interface DirectionBadgeProps {
  direction: "long" | "short";
}

/** §11 text-first: LONG and SHORT are words, never colour alone. */
export function DirectionBadge({ direction }: DirectionBadgeProps) {
  return (
    <span className="pass-chip" data-state={direction === "long" ? "active" : "sl_hit"}>
      {direction === "long" ? "Long" : "Short"}
    </span>
  );
}

export interface PnlProps {
  /** Signed number, or null when there is no figure. */
  value: number | null;
  currency?: string;
}

/**
 * §11.4 Sign glyph is mandatory (U+2212 minus, not a hyphen) and colour is
 * secondary reinforcement only. The accent is NEVER used for PnL.
 *
 * Returns a dash rather than zero when the figure is absent: a derived total
 * must not invent a number it does not have.
 */
export function Pnl({ value, currency = "USDC" }: PnlProps) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="pass-pnl" data-tone="neutral">
        —
      </span>
    );
  }
  const tone = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <span className={["pass-pnl", "pass-value"].join(" ")} data-tone={tone}>
      {`${sign}${abs} ${currency}`}
    </span>
  );
}

export interface MetricProps {
  label: string;
  value: React.ReactNode;
  caption?: string;
}

/** §9.5 Eyebrow label, large mono figure, caption. */
export function StatBlock({ label, value, caption }: MetricProps) {
  return (
    <div className="pass-metric">
      <span className="pass-metric-label">{label}</span>
      <span className="pass-metric-value">{value}</span>
      {caption ? <span className="pass-stale">{caption}</span> : null}
    </div>
  );
}

export interface ReputationProps {
  score: number | null;
  reviewsCount?: number;
  vouchesCount?: number;
  humanVerified?: boolean;
  sourceUrl?: string | null;
  sourceLabel?: string;
}

/**
 * §9.6 / D-007 / PRD §12. Ethos reputation context.
 *
 * Explicitly NOT a trust score and NOT combined with performance. It names its
 * own source, and carries the Ethos disclaimer so the score is never read as an
 * absolute measure of credibility (ETHOS_DISCLAIMER, API-provided).
 */
export function ReputationBlock({
  score,
  reviewsCount,
  vouchesCount,
  humanVerified = false,
  sourceUrl,
  sourceLabel = "Ethos",
}: ReputationProps) {
  return (
    <section aria-label="Reputation" data-pass-block="reputation">
      <h2 className="pass-block-heading">// Reputation \\</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)" }}>
        <StatBlock
          label={`${sourceLabel} score`}
          value={score === null ? "—" : score.toLocaleString("en-US")}
          caption={score === null ? "Not resolved" : "Community sentiment"}
        />
        {reviewsCount !== undefined ? (
          <StatBlock label="Reviews" value={String(reviewsCount)} />
        ) : null}
        {vouchesCount !== undefined ? (
          <StatBlock label="Vouches" value={String(vouchesCount)} />
        ) : null}
        <div className="pass-metric">
          <span className="pass-metric-label">Verification</span>
          <span className="pass-chip" data-state={humanVerified ? "active" : "draft"}>
            {humanVerified ? "Human verified" : "Not verified"}
          </span>
        </div>
      </div>
      {sourceUrl ? (
        <p style={{ marginBlockStart: "var(--space-3)" }}>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="pass-link-btn">
            View {sourceLabel} profile
          </a>
        </p>
      ) : null}
      <p className="pass-stale" style={{ marginBlockStart: "var(--space-3)" }}>
        {sourceLabel} credibility is community sentiment based on public
        interactions. It is not an absolute measure of credibility or
        trustworthiness, and it changes as new data arrives.
      </p>
    </section>
  );
}

export interface PerformanceProps {
  publishedPassCount?: number;
  completedPassCount?: number;
  activePassCount?: number;
  takersCount?: number;
  tpHitCount?: number;
  slHitCount?: number;
  /** Realized PnL across COMPLETED passes only. Never merged with account PnL. */
  totalRealizedPnl?: number | null;
}

/**
 * §9.6 / D-014 / PRD §13. PASS performance only.
 *
 * Carries no reputation field and no prop that could accept one. Every metric
 * states its denominator or window, because "12 taken" and "12 taken this week"
 * are different claims and are worded differently (§11.8).
 */
export function PerformanceBlock(props: PerformanceProps) {
  return (
    <section aria-label="PASS performance" data-pass-block="performance">
      <h2 className="pass-block-heading">// PASS Performance \\</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)" }}>
        {props.publishedPassCount !== undefined ? (
          <StatBlock label="Published" value={String(props.publishedPassCount)} caption="All time" />
        ) : null}
        {props.completedPassCount !== undefined ? (
          <StatBlock label="Completed" value={String(props.completedPassCount)} caption="All time" />
        ) : null}
        {props.activePassCount !== undefined ? (
          <StatBlock label="Active" value={String(props.activePassCount)} caption="Right now" />
        ) : null}
        {props.takersCount !== undefined ? (
          <StatBlock label="Taken" value={String(props.takersCount)} caption="Across all published Passes" />
        ) : null}
        {props.totalRealizedPnl !== undefined ? (
          <StatBlock label="Realized (completed Passes)" value={<Pnl value={props.totalRealizedPnl} />} />
        ) : null}
      </div>
    </section>
  );
}


/* ---------------------------------------------------------------------- */
/* §9.7 State blocks. Each is a component, not an inline branch.            */
/* ---------------------------------------------------------------------- */

/** §9.7 Static sunken wells with an accent hairline. No shimmer loop (§6.2). */
export function LoadingBlock({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-pass-state="loading">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="pass-skeleton" />
      ))}
    </div>
  );
}

/** §9.7 States what is absent and the one action that creates it. */
export function EmptyBlock({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="pass-empty" data-pass-state="empty">
      <span className="pass-block-heading">{title}</span>
      {children ? <p className="pass-stale">{children}</p> : null}
      {action}
    </div>
  );
}

/** §9.7 Plain statement of failure plus Retry. */
export function ErrorBlock({
  title = "Something failed.",
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="pass-error" data-pass-state="error" role="alert">
      <span style={{ fontFamily: "var(--type-title-s-font)", fontSize: "var(--type-title-s-size)" }}>
        {title}
      </span>
      {detail ? <span className="pass-stale">{detail}</span> : null}
      {onRetry ? (
        <button type="button" className="pass-btn" data-variant="primary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** §9.7 Provider unreachable, distinguished from a logic error. */
export function UnavailableBlock({ provider, detail }: { provider: string; detail?: string }) {
  return (
    <div className="pass-error" data-pass-state="unavailable" role="status">
      <span className="pass-block-heading">{provider} unavailable</span>
      <span className="pass-stale">
        {detail ?? `${provider} did not respond. Figures below may be out of date.`}
      </span>
    </div>
  );
}

/** §9.7 Execution rejected by provider, with the provider's reason. */
export function RejectedBlock({ reason }: { reason: string }) {
  return (
    <div className="pass-error" data-pass-state="rejected" role="alert">
      <span className="pass-block-heading">Order rejected</span>
      <span className="pass-stale">{reason}</span>
    </div>
  );
}

export interface HandleBlockProps {
  handle: string;
  xUrl?: string | null;
  verifiedSource?: string | null;
}

/** §9.6 @handle in mono with verified-source markers attributed to the source. */
export function HandleBlock({ handle, xUrl, verifiedSource }: HandleBlockProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <span className="pass-value">@{handle}</span>
      {xUrl ? (
        <a href={xUrl} target="_blank" rel="noopener noreferrer" className="pass-link-btn">
          X
        </a>
      ) : null}
      {verifiedSource ? <span className="pass-chip" data-state="active">{verifiedSource}</span> : null}
    </span>
  );
}
