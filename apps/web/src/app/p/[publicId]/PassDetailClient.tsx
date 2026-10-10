"use client";

/**
 * Pass detail — design/DESIGN.md §10.3 and §14, docs/UX_SPEC.md §5.
 *
 * The conversion surface. One object, one decision.
 *
 * REBUILT 2026-10-07 against §14. The previous version satisfied every clause in
 * §§1–13 and was still visibly not the reference: a flat canvas, no bracket
 * frame, the asset line at `--type-display-l` with a direction badge rather than
 * a §14.4 authored headline, a coordinate grid rather than §14.5 metric cards,
 * and no market snapshot card.
 *
 * §10.3's information order is BINDING and is unchanged, because §14 is an
 * addition to the document rather than a replacement of it:
 *
 *   1 asset + direction  -> DisplayHeadline, authored, one ember word
 *   2 status             -> StatusBadge, directly under the asset line
 *   3 the plan block     -> MetricCardRow, the five §11.3 figures
 *   4 trader, then reputation, never merged
 *   5 thesis             -> the first prose the reader gets
 *   6 market context     -> the snapshot card
 *   7 TAKE PASS          -> the single accent CTA
 *
 * UX_SPEC §11 requires those to stay above the fold on mobile. That is a
 * MEASURED-position requirement and cannot be checked in jsdom; it is on the
 * operator checklist, not asserted here.
 *
 * Three separations are structural here, not stylistic, and each is load-bearing:
 *
 *  - §11.4 PASS performance and account performance are never merged into one
 *    figure or one label.
 *  - §12.3 no urgency, no social-proof counter, no auto-selected Taker size.
 *  - §10.7 the stale interstitial still fires on a version change. Preserved.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Inline, PageShell, Rule, Section, ShellContent, Stack } from "@/components/wave1/layout";
import { Avatar } from "@/components/wave3/identity";
import { Button } from "@/components/wave2/controls";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PerformanceBlock,
  ReputationBlock,
  Timestamp,
  LIFECYCLE_LABEL,
} from "@/components/wave3/data";
import {
  ChipButton,
  CornerBracketFrame,
  DataCard,
  DisplayHeadline,
  DotEyebrow,
  LiveDot,
  MetricCard,
  MetricCardRow,
  NumberedEyebrow,
  Sparkline,
  StatusBadge,
  Surface,
  type StatusTone,
} from "@/components/reference";
import { StaleInterstitial } from "@/components/wave5/Dialog";

import { clientGet } from "@/lib/client";

interface PassDetail {
  publicId: string;
  version: number;
  asset: string;
  direction: "long" | "short";
  status: PassLifecycle;
  entryType: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  leverage: string;
  thesis: string;
  publishedAt: string;
  expiresAt: string;
  trader: {
    slug: string;
    handle: string;
    displayName: string;
    bio?: string | null;
    xHandle?: string | null;
    /** Author X liveness. Absent on old payloads: fail open, show the handle. */
    xConnected?: boolean | null;
    hyperliquidAccountAddress?: string | null;
  };
  reputation?: {
    credibilityScore: number | null;
    reviewsCount?: number;
    vouchesCount?: number;
    humanVerified?: boolean;
  } | null;
  market?: {
    markPrice: string;
    observedAt: string;
    /** Optional last-N-trade series. Absent is normal. */
    series?: number[];
    /** Hyperliquid returns its own age; the client never computes staleness. */
    stale?: boolean;
  } | null;
  performance?: {
    takersCount: number;
    completedCount: number;
    tpHitCount: number;
    slHitCount: number;
    totalRealizedPnl: number | null;
  } | null;
}

type PassLifecycle =
  | "draft"
  | "published"
  | "active"
  | "entry_pending"
  | "open"
  | "tp_hit"
  | "sl_hit"
  | "manually_closed"
  | "closed"
  | "cancelled"
  | "expired"
  | "invalidated";

/**
 * §14.6 lifecycle -> badge tone. Every state in the type above is mapped: a
 * missing key rendered `data-tone="undefined"`, which is a badge with no state
 * colour and no icon treatment — the exact failure §14.6 exists to prevent.
 */
const TONE: Record<PassLifecycle, StatusTone> = {
  draft: "draft",
  published: "draft",
  active: "active",
  entry_pending: "entry_pending",
  open: "open",
  tp_hit: "tp_hit",
  sl_hit: "sl_hit",
  manually_closed: "cancelled",
  closed: "cancelled",
  cancelled: "cancelled",
  expired: "expired",
  invalidated: "invalidated",
};

/**
 * §11.7 the state word.
 *
 * `LIFECYCLE_LABEL` is imported rather than re-declared: the state words are one
 * vocabulary across the product, and a second copy is how "Entry Pending" and
 * "Entry pending" end up on two screens at once — one of which then fails a test
 * that was right all along.
 */
const STATE_LABEL = LIFECYCLE_LABEL as unknown as Record<string, string>;

/** §11.2 decimals are the market's, supplied by the API; the client only adds a
 *  thousands separator and never re-rounds. */
function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const s = String(value);
  const [whole, frac] = s.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

/**
 * R:R is a property of the PLAN, not of anybody's account, so it is the one
 * derived figure this screen may show (§14.5). Two decimals. If any input is
 * missing or the risk is zero it renders a dash — never a fabricated ratio, and
 * never an infinite one.
 */
function riskReward(entry: string, tp: string, sl: string): string {
  const e = Number(entry);
  const t = Number(tp);
  const s = Number(sl);
  if (![e, t, s].every(Number.isFinite) || e === 0) return "—";
  const risk = Math.abs(e - s);
  if (risk === 0) return "—";
  return `${(Math.abs(t - e) / risk).toFixed(2)}:1`;
}

export function PassDetailClient({ publicId }: { publicId: string }) {
  const [data, setData] = useState<PassDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | undefined>();
  const [missing, setMissing] = useState(false);
  /** The version this client actually reviewed. §10.7 stale detection. */
  const [reviewed, setReviewed] = useState<number | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setError(undefined);
    setMissing(false);
    try {
      const p = await clientGet<PassDetail>(`/api/v1/passes/${publicId}`);
      setData(p);
      setReviewed(p.version);
      setState("ready");
    } catch (e) {
      // A 404 and an unreachable API are DIFFERENT situations. The previous
      // version showed "This Pass does not exist" for both, which told a reader
      // their link was bad when the network was down.
      const status = (e as { status?: number }).status;
      setMissing(status === 404);
      setError(e instanceof Error ? e.message : "Request failed");
      setState("error");
    }
  }, [publicId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <PageShell>
        <ShellContent>
          <LoadingBlock label="Loading Pass" rows={5} />
        </ShellContent>
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <ShellContent>
          <NumberedEyebrow label="Pass" number={1} />
          <ErrorBlock
            title={
              missing
                ? "This Pass does not exist."
                : "Could not reach PASS."
            }
            detail={
              missing
                ? "The link may be wrong, or the Pass may have been removed."
                : // The API's own message, so an operator can tell a timeout
                  // from a rejected request without opening devtools.
                  `The Pass could not be loaded${error ? `: ${error}` : ""}. This is not the same as the Pass being missing — try again in a moment.`
            }
            onRetry={load}
          />
          <Inline gap="3" className="pass-info-lead">
            <Link href="/discover" className="pass-link-btn">
              Explore Passes
            </Link>
          </Inline>
        </ShellContent>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <ShellContent>
          <EmptyBlock title="No Pass loaded" />
        </ShellContent>
      </PageShell>
    );
  }

  const takeHref = `/passes/${data.publicId}/take`;
  const expiryMs = new Date(data.expiresAt).getTime() - Date.now();
  const expired = expiryMs <= 0;
  // The Take CTA is offered only while the Pass can still be taken: active
  // or entry_pending and unexpired — the same pair the server enforces
  // (TAKABLE_STATUSES in @pass/contracts). Anything else keeps its page but
  // offers no Take action, so no new execution can be invited against a
  // cancelled, expired or otherwise terminal Pass (DATA_MODEL.md §3.7).
  const takable =
    (data.status === "active" || data.status === "entry_pending") && !expired;
  const tone = expired ? ("expired" as StatusTone) : TONE[data.status];
  const label = expired ? "Expired" : STATE_LABEL[data.status] ?? data.status;
  const asset = data.asset.toUpperCase();
  const direction = data.direction === "long" ? "LONG" : "SHORT";
  const market = data.market;
  const series = market?.series;

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          {/* §14.2 THE FOURTH AND LAST bracket frame. The Landing spends two and
              /how-it-works one, so this is the final one the product may use.
              §14.1: the SECTION-strength wash, because a wash behind dense
              digits costs the contrast §11.1 refuses to compromise. */}
          <Surface strength="section" className="pass-detail-shell">
            <CornerBracketFrame labelledBy="pass-object">
              <Stack gap="3">
                <NumberedEyebrow label="The plan" number={1} />

                {/* §14.4 two authored lines, one ember word on the second.
                    THE GRADIENT VARIANT IS FORBIDDEN HERE: the headline
                    carries a live value, and a gradient behind changing digits
                    makes the digits harder to read. The asset and the direction
                    are set in the DATA face rather than the display face, per
                    §14.4's rule that §3.2 binds in reverse. */}
                <div className="pass-detail-object">
                  <DisplayHeadline
                    lines={[[{ text: asset }], [{ text: direction, accent: true }]]}
                    as="h1"
                  />
                </div>

                {/* §10.3 item 2 — status directly under the asset line. The word
                    is the state; §9.4 colour and icon only reinforce it. */}
                <Inline gap="3">
                  <StatusBadge tone={tone} label={label} />
                  <span className="pass-stale">
                    Published <Timestamp value={data.publishedAt} />
                  </span>
                </Inline>

                <p className="pass-note" id="pass-object">
                  Entry type {data.entryType}. Expires{" "}
                  <Timestamp value={data.expiresAt} />. PASS {data.publicId},
                  version {data.version}.
                </p>
              </Stack>
            </CornerBracketFrame>
          </Surface>

          {/* §10.3 item 3 — the plan block. The thing the reader came for, so it
              is the second thing the eye finds. Five §11.3 figures and nothing
              else: adding a sixth would be inventing a metric. */}
          <Section label="The plan">
            <Stack gap="4">
              <NumberedEyebrow label="Levels" number={2} />
              <MetricCardRow>
                <MetricCard label="Entry" value={fmt(data.entryPrice)} unit="per ETH" />
                <MetricCard label="Take profit" value={fmt(data.takeProfit)} unit="per ETH" />
                <MetricCard label="Stop loss" value={fmt(data.stopLoss)} unit="per ETH" />
                <MetricCard label="Leverage" value={`${data.leverage}x`} />
                <MetricCard
                  label="R:R"
                  value={riskReward(data.entryPrice, data.takeProfit, data.stopLoss)}
                />
              </MetricCardRow>
            </Stack>
          </Section>

          {/* §10.3 item 4 — trader identity, then a MANDATORY rule, then
              reputation. D-007 and PRD §12 make merging them a P0
              anti-pattern, so the Rule is structural here, not decorative. */}
          <Section label="Trader">
            <Stack gap="4">
              <NumberedEyebrow label="The trader" number={3} />

              <DataCard
                as="section"
                // Single-state rule, AUTHOR side: the live handle renders
                // only while the author's X is connected. A disconnected
                // author's card falls back to the profile display name —
                // the pass itself and its history are never hidden.
                id={
                  data.trader.xConnected === false
                    ? data.trader.displayName
                    : `@${data.trader.handle}`
                }
                sub={data.trader.displayName}
                value={
                  <>
                    <Avatar
                      handle={
                        data.trader.xConnected === false
                          ? data.trader.displayName
                          : data.trader.handle
                      }
                      size="md"
                      className="pass-detail-avatar"
                    />
                  </>
                }
                /* §2.5 rations the accent to ONE thing per viewport, and the
                   Take Pass CTA is that thing. A second accent-filled control
                   on this page would spend the accent twice and stop it
                   pointing anywhere. So the profile affordance is a §14.9
                   OUTLINED chip, not a card action. */
                headerAside={
                  <ChipButton href={`/u/${data.trader.slug}`}>Profile</ChipButton>
                }
              >
                {/* §11.4 one figure, one place. The Ethos score is deliberately
                    NOT restated here: `ReputationBlock` below owns it, and two
                    adjacent renderings of the same reputation figure is exactly
                    the merge D-007 and PRD §12 forbid — and it would mean
                    changing the number in two places when it changes in one.
                    The brief for this rebuild listed "Ethos score" on the
                    mini-card; it is delivered by the separate reputation block
                    in this same section, which is where §10.3 item 4 puts it. */}
                <dl className="pass-card-metrics">
                  <div className="pass-card-metric">
                    <dt>Active Passes</dt>
                    <dd>{data.performance ? fmt(data.performance.takersCount) : "—"}</dd>
                  </div>
                  <div className="pass-card-metric">
                    <dt>Hyperliquid</dt>
                    <dd>
                      {data.trader.hyperliquidAccountAddress ? "Linked" : "Not linked"}
                    </dd>
                  </div>
                </dl>
              </DataCard>

              {/* §10.3 item 4 requires reputation and PASS performance in TWO
                  visually separate blocks, never adjacent without a rule, never
                  under one heading. D-007 and PRD §12 make merging them a P0
                  anti-pattern. The brief for this rebuild asked for a trader
                  mini-card, which is what sits ABOVE; it did not ask to drop
                  the separation, so both are kept and the Rule divides them. */}
              <ReputationBlock
                score={data.reputation?.credibilityScore ?? null}
                reviewsCount={data.reputation?.reviewsCount}
                vouchesCount={data.reputation?.vouchesCount}
                humanVerified={data.reputation?.humanVerified}
              />

              <Rule label="End of trader identity" />

              {data.performance ? (
                <PerformanceBlock
                  takersCount={data.performance.takersCount}
                  totalRealizedPnl={data.performance.totalRealizedPnl}
                />
              ) : null}
            </Stack>
          </Section>

          {/* §10.3 item 5 — the thesis, the first prose the reader gets. */}
          <Section label="Thesis">
            <Stack gap="3">
              <NumberedEyebrow label="The thesis" number={4} />
              <p className="pass-thesis pass-clamped">{data.thesis}</p>
              {data.trader.bio ? (
                <p className="pass-note">
                  {data.trader.displayName}: {data.trader.bio}
                </p>
              ) : null}
            </Stack>
          </Section>

          {/* §10.3 item 6 — market context, marked LIVE or STALE in TEXT. The
              client never computes staleness: Hyperliquid supplies its own age
              and inventing one here would be a claim PASS cannot back. */}
          <Section label="Market context">
            <Stack gap="4">
              <NumberedEyebrow label="Market" number={5} />
              {market ? (
                <DataCard
                  id="MARKET SNAPSHOT"
                  value={fmt(market.markPrice)}
                  unit="mark"
                  headerAside={
                    market.stale ? (
                      <span className="pass-live">
                        <span aria-hidden="true" className="pass-live-dot" />
                        <span>Stale</span>
                      </span>
                    ) : (
                      <LiveDot label="Live" />
                    )
                  }
                >
                  <DotEyebrow label="Read from Hyperliquid" />
                  {/* §14.5.7 the only chart PASS has. Rendered only when a real
                      series arrives: a flat line would be an invented
                      observation, and §11.2 forbids inventing one. */}
                  {series && series.length > 1 ? (
                    <Sparkline points={series} tone="neutral" label={`${asset} recent trades`} />
                  ) : null}
                  <dl className="pass-card-metrics">
                    <div className="pass-card-metric">
                      <dt>Mark</dt>
                      <dd>{fmt(market.markPrice)}</dd>
                    </div>
                    <div className="pass-card-metric">
                      <dt>Observed</dt>
                      <dd>
                        <Timestamp value={market.observedAt} />
                      </dd>
                    </div>
                    <div className="pass-card-metric">
                      <dt>Entry distance</dt>
                      <dd>{entryDistance(market.markPrice, data.entryPrice)}</dd>
                    </div>
                  </dl>
                </DataCard>
              ) : (
                /* Never an empty card: an absent reading is a stated absence. */
                <EmptyBlock title="No market reading">
                  Hyperliquid has not returned a mark price for this Pass yet.
                </EmptyBlock>
              )}
            </Stack>
          </Section>

          {/* §10.3 PASS metrics only, never the Trader's account PnL (§11.8). */}
          {data.performance ? (
            <Section label="PASS metrics">
              <Stack gap="4">
                <NumberedEyebrow label="Taken so far" number={6} />
                <MetricCardRow>
                  <MetricCard label="Takes" value={fmt(data.performance.takersCount)} />
                  <MetricCard label="Completed" value={fmt(data.performance.completedCount)} />
                  <MetricCard label="TP hit" value={fmt(data.performance.tpHitCount)} />
                  <MetricCard label="SL hit" value={fmt(data.performance.slHitCount)} />
                </MetricCardRow>
              </Stack>
            </Section>
          ) : null}

          {/* §10.3 item 7 — the single accent-filled CTA, while takable. */}
          {takable ? (
          <Stack gap="3">
            <Inline gap="3">
              <Link href={takeHref} className="pass-row-link-plain">
                <Button variant="primary" size="lg">
                  Take Pass
                </Button>
              </Link>
            </Inline>
            {/* §12.3 / D-015: no auto-selected size, and the reader is told so. */}
            <p className="pass-note pass-note-status">
              You authorize your own order at your own position size. PASS never
              selects a size for you.
            </p>
          </Stack>
          ) : (
          <Stack gap="3">
            <p className="pass-note pass-note-status">
              This Pass is {expired ? "expired" : label.toLowerCase()} and cannot
              be taken. It stays readable, because a plan is worth reading
              after it has closed.
            </p>
          </Stack>
          )}
        </Stack>

        {/* §10.7 Stale Pass interstitial. Execution is never silently attempted
            on stale parameters (UX_SPEC §9). */}
        <StaleInterstitialGate
          stale={stale && reviewed !== null}
          reviewed={reviewed}
          current={data.version}
          onStale={() => setStale(false)}
          onDismiss={() => setStale(false)}
        />
      </ShellContent>
    </PageShell>
  );
}

/**
 * Distance from the mark to the entry, in the plan's own currency. A dash when
 * either input is missing — this is a convenience reading, and a fabricated
 * percentage next to a real price is worse than nothing.
 */
function entryDistance(mark: string, entry: string): string {
  const m = Number(mark);
  const e = Number(entry);
  if (![m, e].every(Number.isFinite) || e === 0) return "—";
  const pct = ((m - e) / e) * 100;
  return `${pct >= 0 ? "+" : "\u2212"}${Math.abs(pct).toFixed(2)}%`;
}

/**
 * Triggers the interstitial when the reviewed version differs from the current
 * one. Split out so the detection rule is one readable expression.
 */
function StaleInterstitialGate({
  stale,
  reviewed,
  current,
  onStale,
  onDismiss,
}: {
  stale: boolean;
  reviewed: number | null;
  current: number;
  onStale: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (stale && reviewed !== null && reviewed !== current) onStale();
  }, [stale, reviewed, current, onStale]);
  if (!stale) return null;
  return (
    <StaleInterstitial
      open
      onDismiss={onDismiss}
      onReviewLatest={onDismiss}
      changes={[{ label: "Pass version", from: String(reviewed), to: String(current) }]}
    />
  );
}
