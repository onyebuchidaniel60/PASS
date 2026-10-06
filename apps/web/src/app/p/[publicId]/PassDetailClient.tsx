"use client";

/**
 * Pass detail — design/DESIGN.md §10.3, docs/UX_SPEC.md §5.
 *
 * The conversion surface. One object, one decision. The information order in
 * §10.3 is binding and asserted in the test by DOM order:
 *
 *   status -> asset + direction -> trader -> Ethos -> ENTRY/TP/SL/LEVERAGE
 *          -> thesis -> market context -> PASS metrics -> TAKE PASS
 *
 * UX_SPEC §11 requires asset+direction, trader, reputation, entry/TP/SL, status
 * and the CTA to stay above the fold on mobile. That is a MEASURED-position
 * requirement and cannot be checked in jsdom; it is on the operator checklist.
 *
 * Two separations are structural here, not stylistic:
 *  - §11.4 PASS performance and Hyperliquid account performance are never merged
 *    into one figure or one label.
 *  - §12.3 no urgency, no social-proof counter, no auto-selected Taker size.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  ChamferPanel,
  Inline,
  PageShell,
  Panel,
  Rule,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import {
  CoordinateGrid,
  CoordinatePair,
  Reticle,
  SignalLine,
} from "@/components/wave1/signature";
import { Button } from "@/components/wave2/controls";
import {
  Address,
  DirectionBadge,
  EmptyBlock,
  ErrorBlock,
  HandleBlock,
  LiveOrStale,
  LoadingBlock,
  PerformanceBlock,
  ReputationBlock,
  StatusChip,
  Timestamp,
  type PassLifecycle,
} from "@/components/wave3/data";
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
    hyperliquidAccountAddress?: string | null;
  };
  reputation?: {
    credibilityScore: number | null;
    reviewsCount?: number;
    vouchesCount?: number;
    humanVerified?: boolean;
  } | null;
  market?: { markPrice: string; observedAt: string } | null;
  performance?: {
    takersCount: number;
    completedCount: number;
    tpHitCount: number;
    slHitCount: number;
    totalRealizedPnl: number | null;
  } | null;
}

/** §11.2 decimals are the market's, supplied by the API; the client only adds a
 *  thousands separator and never re-rounds. */
function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const s = String(value);
  const [whole, frac] = s.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

export function PassDetailClient({ publicId }: { publicId: string }) {
  const [data, setData] = useState<PassDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | undefined>();
  /** The version this client actually reviewed. §10.7 stale detection. */
  const [reviewed, setReviewed] = useState<number | null>(null);
  const [stale, setStale] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setError(undefined);
    try {
      const p = await clientGet<PassDetail>(`/api/v1/passes/${publicId}`);
      setData(p);
      setReviewed(p.version);
      setState("ready");
    } catch (e) {
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
          {/* §10.12 a plain statement plus exactly one accent action. */}
          <ErrorBlock
            title="This Pass does not exist."
            detail={error}
            onRetry={load}
          />
          <Inline gap="3" style={{ marginBlockStart: "var(--space-5)" }}>
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

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          {/* §10.3 item 1 — asset + direction, the largest element on the page. */}
          <Section label="Trade" className="pass-detail-head">
            <span className="pass-eyebrow" data-delimiter="true">
              Pass {data.publicId}
            </span>
            <h1 className="pass-asset-line">
              {data.asset.toUpperCase()}{" "}
              <DirectionBadge direction={data.direction} />
            </h1>
            {/* §10.3 item 2 — status chip directly under the asset line. */}
            <Inline gap="3" style={{ marginBlockStart: "var(--space-3)" }}>
              <StatusChip state={data.status} />
              {expired ? <StatusChip state="expired" /> : null}
              <Timestamp value={data.publishedAt} />
            </Inline>
          </Section>

          {/* §10.3 item 3 — the plan block. The thing the user came for. */}
          <ChamferPanel label="Trade plan">
            <Inline gap="2">
              <Reticle label="Plan origin" />
              <span className="pass-block-heading">The plan.</span>
            </Inline>
            <CoordinateGrid>
              <CoordinatePair label="Entry" value={fmt(data.entryPrice)} />
              <CoordinatePair label="TP" value={fmt(data.takeProfit)} />
              <CoordinatePair label="SL" value={fmt(data.stopLoss)} />
              <CoordinatePair label="Leverage" value={`${data.leverage}x`} />
            </CoordinateGrid>
            <Inline gap="4" style={{ marginBlockStart: "var(--space-4)" }}>
              <span className="pass-stale">Entry type {data.entryType}</span>
              <span className="pass-stale">
                Expires <Timestamp value={data.expiresAt} />
              </span>
            </Inline>
          </ChamferPanel>

          {/* §10.3 item 4 — trader, then reputation, never merged. */}
          <Section label="Trader" as="section">
            <Panel>
              <Stack gap="4">
                <Stack gap="2">
                  <span className="pass-block-heading">// Trader \\</span>
                  <HandleBlock
                    handle={data.trader.handle}
                    xUrl={
                      data.trader.xHandle
                        ? `https://x.com/${data.trader.xHandle}`
                        : null
                    }
                    verifiedSource="X connected"
                  />
                  {data.trader.bio ? (
                    <p className="pass-thesis">{data.trader.bio}</p>
                  ) : null}
                  {data.trader.hyperliquidAccountAddress ? (
                    <span className="pass-stale">
                      Hyperliquid{" "}
                      <Address value={data.trader.hyperliquidAccountAddress} />
                    </span>
                  ) : null}
                </Stack>

                {/* MANDATORY rule between performance and reputation: D-007 and
                    PRD §12 make merging them a P0 anti-pattern. */}
                <Rule label="End of trader identity" />

                <ReputationBlock
                  score={data.reputation?.credibilityScore ?? null}
                  reviewsCount={data.reputation?.reviewsCount}
                  vouchesCount={data.reputation?.vouchesCount}
                  humanVerified={data.reputation?.humanVerified}
                />
              </Stack>
            </Panel>
          </Section>

          {/* §10.3 item 5 — thesis, the first prose the user reads. */}
          <Section label="Thesis">
            <p className="pass-thesis pass-clamped">{data.thesis}</p>
          </Section>

          {/* §10.3 item 6 — market context, marked LIVE or STALE. */}
          {data.market ? (
            <Section label="Market context">
              <SignalLine />
              <Inline gap="4" style={{ marginBlockStart: "var(--space-3)" }}>
                <CoordinatePair label="Mark" value={fmt(data.market.markPrice)} />
                <LiveOrStale observedAt={data.market.observedAt} />
              </Inline>
            </Section>
          ) : null}

          {/* §10.3 PASS metrics only. Never the Trader's account PnL (§11.8). */}
          {data.performance ? (
            <Section label="PASS metrics">
              <PerformanceBlock
                takersCount={data.performance.takersCount}
                totalRealizedPnl={data.performance.totalRealizedPnl}
              />
            </Section>
          ) : null}

          {/* §10.3 item 7 — the single accent-filled CTA. */}
          <Inline gap="3">
            <Link href={takeHref} style={{ textDecoration: "none" }}>
              <Button variant="primary" size="lg">
                Take Pass
              </Button>
            </Link>
          </Inline>

          <span className="pass-stale">
            You authorize your own order at your own position size. PASS never
            selects a size for you.
          </span>
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
