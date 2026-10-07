"use client";

/**
 * Discover — design/DESIGN.md §10.2 and §14, docs/UX_SPEC.md.
 *
 * Purpose: let a visitor find a Pass worth opening. The list is the content;
 * filters and the count are context.
 *
 * The operator reported this screen as "colors not applied, feels dull". The
 * cause was structural, not a missing colour: the previous version rendered a
 * list of full-width text rows with a direction chip and three coordinate pairs.
 * §14.5 requires a data-card GRID, and the reference set is defined by its
 * cards — identifier, one muted sub-line, an oversized figure, metric rows, a
 * status row. A list of rows cannot carry that anatomy, so nothing the token
 * layer added could make it feel like the reference.
 *
 * §10.2's row anatomy is preserved inside the card: direction, asset, status,
 * entry / take profit / stop loss, and publish time. Two rules carried over from
 * the old row and still enforced:
 *  - **trades performance metrics are NOT shown.** The visitor has taken nothing,
 *    and PASS does not imply account performance proves Pass performance
 *    (PRD §13). A Discover card showing PnL would be a synthetic-trust
 *    anti-pattern (§12.3).
 *  - filters are always visible, never behind a menu (§10.2 item 2).
 *
 * The route is GET /api/v1/discover?limit=&status= — it supports a status filter
 * and a limit but no cursor, so no pagination control is invented.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";
import { Button } from "@/components/wave2/controls";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/wave3/data";
import {
  ChipBar,
  ChipButton,
  DataCard,
  DisplayHeadline,
  DotEyebrow,
  HERO_LINES,
  LiveDot,
  NumberedEyebrow,
  Sparkline,
  StatusBadge,
  Surface,
  TickerBar,
  type StatusTone,
  type TickerEntry,
} from "@/components/reference";

import { clientGet } from "@/lib/client";

interface DiscoverPass {
  publicId: string;
  asset: string;
  direction: "long" | "short";
  status: PassLifecycle;
  entryPrice: string;
  takeProfit: string;
  stopLoss: string;
  publishedAt: string;
  canonicalPath: string;
  /** Optional 24h series. Absent is normal: §11.2 forbids inventing one. */
  sparkline?: number[];
}

type PassLifecycle = "draft" | "published" | "active" | "entry_pending" | "open" | "closed" | "cancelled" | "expired";

type StatusFilter = "all" | "active" | "open";

/** §14.6 maps a lifecycle state onto a badge tone. */
const TONE: Record<PassLifecycle, StatusTone> = {
  draft: "draft",
  published: "draft",
  active: "active",
  entry_pending: "entry_pending",
  open: "open",
  closed: "cancelled",
  cancelled: "cancelled",
  expired: "expired",
};

/** §11.7 the state word. Uppercase by the badge; written out here once. */
const STATE_LABEL: Record<PassLifecycle, string> = {
  draft: "Draft",
  published: "Published",
  active: "Active",
  entry_pending: "Entry pending",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const STATUS_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
];

/** §11.2 thousands separator only. The client never re-rounds. */
function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const [w, f] = String(v).split(".");
  return `${w.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f ? `.${f}` : ""}`;
}

/** §11.5 relative form is secondary and tertiary. */
function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * §14.5 R:R is the one derived figure a Discover card may show, because it is a
 * property of the PLAN and not of anybody's account. Two decimals, and a card
 * whose inputs are missing renders a dash rather than a guess.
 */
function riskReward(p: DiscoverPass): string {
  const entry = Number(p.entryPrice);
  const tp = Number(p.takeProfit);
  const sl = Number(p.stopLoss);
  if (![entry, tp, sl].every(Number.isFinite) || entry === 0) return "—";
  const reward = Math.abs(tp - entry);
  const risk = Math.abs(entry - sl);
  if (risk === 0) return "—";
  return `${(reward / risk).toFixed(2)}:1`;
}

/**
 * §14.8 the ticker reads the same figures the cards do, so it cannot disagree
 * with them. Derived from the loaded Passes: a separate market request would be
 * a second source of truth for a number the page already has.
 */
function tickerFrom(passes: DiscoverPass[]): TickerEntry[] {
  return passes.slice(0, 6).map((p) => {
    const entry = Number(p.entryPrice);
    const tp = Number(p.takeProfit);
    const change = Number.isFinite(entry) && Number.isFinite(tp) && entry !== 0
      ? ((tp - entry) / entry) * 100
      : Number.NaN;
    return {
      symbol: p.asset,
      price: fmt(p.entryPrice),
      change: Number.isFinite(change) ? `${change >= 0 ? "+" : "\u2212"}${Math.abs(change).toFixed(2)}%` : undefined,
      tone: !Number.isFinite(change) ? ("neutral" as const) : change >= 0 ? ("positive" as const) : ("negative" as const),
    };
  });
}

export function DiscoverClient() {
  const [passes, setPasses] = useState<DiscoverPass[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setError(undefined);
    try {
      const q = status === "all" ? "" : `&status=${status}`;
      const res = await clientGet<{ passes?: DiscoverPass[] }>(
        `/api/v1/discover?limit=30${q}`,
      );
      setPasses(res.passes ?? []);
      setState("ready");
    } catch {
      setError("Could not load Passes.");
      setState("error");
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  // The row filter is applied client-side too, so changing status does not
  // blank the list before the request resolves.
  const visible = useMemo(
    () => (status === "all" ? passes : passes.filter((p) => p.status === status)),
    [passes, status],
  );

  const ticker = useMemo(() => tickerFrom(passes), [passes]);

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          {/* §14.1 the Discover header takes the SECTION-strength wash: this page
              is data-heavy, so it does not get the hero wash (§14.1's flat rule
              applies to the card grid below, which carries grain only). */}
          <Surface strength="section" className="pass-discover-head">
            <NumberedEyebrow label="Live passes" number={1} />
            {/* §14.4 two authored lines, one ember word on line one. */}
            <DisplayHeadline
              section
              as="h1"
              lines={HERO_LINES.discover.map((l) => l.map((w) => ({ ...w })))}
            />
            <p className="pass-landing-lede">
              Published Hyperliquid plans you can read before you commit a dollar.
              Every card states its entry, its target and its stop.
            </p>
          </Surface>

          {/* §14.8 the data bar, directly under the header. It reports
              unavailable rather than rendering empty. */}
          <TickerBar entries={ticker} unavailable={state !== "ready" || ticker.length === 0} />

          <Section label="Discover">
            <Stack gap="4">
              {/* §10.2 item 2 — filters always visible, never behind a menu.
                  §14.9 renders them as chamfered chips with exactly one
                  selected, which is §2.5's accent ration applied to a bar. */}
              <ChipBar label="Filter by status">
                {STATUS_OPTIONS.map((o) => (
                  <ChipButton
                    key={o.value}
                    toggle
                    selected={status === o.value}
                    onClick={() => setStatus(o.value)}
                  >
                    {o.label}
                  </ChipButton>
                ))}
              </ChipBar>

              {/* §10.2 item 3 — a mono count so the list is self-describing when
                  short. §14.3's dot variant, because this section is live. */}
              <DotEyebrow label="Published plans">
                <span className="pass-stale">
                  {state === "ready"
                    ? `${visible.length} ${visible.length === 1 ? "Pass" : "Passes"}`
                    : "Counting…"}
                </span>
              </DotEyebrow>
            </Stack>
          </Section>

          {state === "loading" ? (
            <LoadingBlock label="Loading Passes" rows={4} />
          ) : state === "error" ? (
            <ErrorBlock detail={error} onRetry={load} />
          ) : visible.length === 0 ? (
            /* §10.2 empty state names the absence and offers Create a Pass. */
            <EmptyBlock
              title="No Passes match this filter"
              action={
                <Link href="/passes/new" className="pass-row-link-plain">
                  <Button variant="primary" size="md">
                    Create a Pass
                  </Button>
                </Link>
              }
            >
              Nothing is published under this status right now.
            </EmptyBlock>
          ) : (
            /* §14.5 the card grid. `auto-fit` decides the column count from the
               available width, so no hand-set breakpoint can drift. */
            <div className="pass-info-cards">
              {visible.map((p) => {
                const href = p.canonicalPath || `/p/${p.publicId}`;
                const series = p.sparkline;
                const tone: StatusTone = TONE[p.status] ?? "draft";

                return (
                  <DataCard
                    key={p.publicId}
                    id={`${p.asset} ${p.direction === "long" ? "LONG" : "SHORT"}`}
                    sub={relative(p.publishedAt) ? `Published ${relative(p.publishedAt)}` : undefined}
                    value={fmt(p.entryPrice)}
                    unit="per unit"
                    headerAside={
                      tone === "active" || tone === "open" ? (
                        <LiveDot label="Live" />
                      ) : (
                        <StatusBadge tone={tone} label={STATE_LABEL[p.status] ?? p.status} variant="bare" />
                      )
                    }
                    status={{ tone, label: STATE_LABEL[p.status] ?? p.status }}
                    metrics={[
                      { label: "Take profit", value: fmt(p.takeProfit) },
                      { label: "Stop loss", value: fmt(p.stopLoss) },
                      { label: "R:R", value: riskReward(p) },
                    ]}
                    action={{ label: "Open Pass", href }}
                    interactive
                  >
                    {/* §14.5.7 the only chart PASS has. Rendered only when the
                        payload carries a real series: §11.2 forbids inventing
                        one, and a flat line would be an invented observation. */}
                    {series && series.length > 1 ? (
                      <Sparkline
                        points={series}
                        tone={tone === "sl_hit" || tone === "expired" ? "negative" : "positive"}
                        label={`${p.asset} last 24 hours`}
                      />
                    ) : null}
                    {/* The whole card is a hit target as well as the action, so
                        §14.5's hover state is reachable from anywhere on it. */}
                    <Link href={href} className="visually-hidden">
                      Open {p.asset} {p.direction} Pass
                    </Link>
                  </DataCard>
                );
              })}
            </div>
          )}
        </Stack>
      </ShellContent>
    </PageShell>
  );
}
