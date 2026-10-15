"use client";

/**
 * Trader profile — design/DESIGN.md §10.4 + §14.4, docs/UX_SPEC.md §6.
 *
 * Establish identity and credibility as a VERIFIED CREDENTIAL, not a social bio.
 *
 * The binding rule: PASS performance and Ethos reputation are two visually and
 * structurally separate blocks with a mandatory Rule between them. Merging them
 * into one score, one label, or one card is a P0 anti-pattern (D-007, PRD §12).
 * That is asserted structurally in the test, not merely documented here.
 *
 * §14.4 shape: credential header, then two §14.3 data cards (Ethos, PASS
 * performance) split by the mandatory rule, then the Active Passes grid.
 *
 * ONE FIGURE, ONE PLACE (§11.4): the credibility score is rendered by
 * `ReputationBlock` only. The Ethos card deliberately does not restate it in its
 * own value slot, for the same reason Pass detail does not: two adjacent
 * renderings of one reputation number is the merge D-007 forbids, and it means
 * changing the number in two places when it changes in one.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Avatar } from "@/components/wave3/identity";
import { Button } from "@/components/wave2/controls";
import { Panel, Rule } from "@/components/wave1/layout";
import {
  EmptyBlock,
  ErrorBlock,
  HandleBlock,
  LoadingBlock,
  PerformanceBlock,
  ReputationBlock,
  StatBlock,
  StatusChip,
  UnavailableBlock,
} from "@/components/wave3/data";
import {
  CornerBracketFrame,
  type StatusTone,
} from "@/components/reference";
import { DataTable, StatRow, type DataTableColumn } from "@/components/wave3/table";

import { clientGet } from "@/lib/client";
import { connectionByName } from "@/lib/me";

interface Connection {
  provider: string;
  connected: boolean;
  label: string;
}

export interface Profile {
  slug: string;
  handle: string;
  displayName: string;
  bio?: string | null;
  xHandle?: string | null;
  hyperliquidAccountAddress?: string | null;
  connections?: Connection[];
  publishedPassCount?: number;
  completedPassCount?: number;
  activePassCount?: number;
  /**
   * PASS performance counters the API actually returns. §10.4 allows a "PASS
   * success metric, observed account context where legitimately available" — so
   * this list is exactly what is returned. Win rate, average R, and TP-hit rate
   * are NOT here, and the screen states their absence rather than deriving a
   * number from a counter that cannot support one.
   */
  reputation?: {
    credibilityScore: number | null;
    reviewsCount?: number;
    vouchesCount?: number;
    humanVerified?: boolean;
  } | null;
}

interface PassSummary {
  publicId: string;
  asset: string;
  direction: "long" | "short";
  status: string;
  entryPrice?: string;
  takeProfit?: string;
  stopLoss?: string;
}

/**
 * Stage G trader performance (`GET /api/v1/profiles/:slug/performance`).
 * Accepted only in the DTO shape — anything else (including a legacy
 * payload echoed back by a stub) degrades to the legacy counts UI rather
 * than rendering a half figure.
 */
interface TraderPerformance {
  slug: string;
  publishedPasses: number;
  completedPasses: number;
  passSuccessMetric: number | null;
  successMetricWindow: string;
  averageRMultiple: number | null;
  totalRealizedPnl: string | null;
  simulated: boolean | null;
}

function isTraderPerformance(v: unknown): v is TraderPerformance {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.publishedPasses === "number" &&
    (typeof o.simulated === "boolean" || o.simulated === null)
  );
}

function numOrUndef(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const [w, f] = String(v).split(".");
  return `${w.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f ? `.${f}` : ""}`;
}

/** Unknown lifecycle strings fall back to a neutral tone rather than crashing. */
function toneFor(status: string): StatusTone {
  const known: StatusTone[] = [
    "draft",
    "active",
    "open",
    "entry_pending",
    "cancelled",
    "expired",
    "invalidated",
    "tp_hit",
    "sl_hit",
  ];
  return known.includes(status as StatusTone)
    ? (status as StatusTone)
    : "draft";
}

/**
 * The trader's passes as table columns (ref 14 activity rhythm). Plan
 * levels only — never outcome numbers attributed to a Pass the reader has
 * not taken. One link per row (the asset line); nothing nests inside it.
 */
const passTableColumns: DataTableColumn<PassSummary>[] = [
  {
    key: "pass",
    label: "Pass",
    render: (p) => (
      <Link href={`/p/${p.publicId}`} className="pass-link-btn">
        {p.asset} {p.direction === "long" ? "Long" : "Short"}
      </Link>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (p) => <StatusChip state={toneFor(p.status)} />,
  },
  {
    key: "entry",
    label: "Entry",
    numeric: true,
    inStack: false,
    render: (p) => <span className="pass-num">{fmt(p.entryPrice)}</span>,
  },
  {
    key: "tp",
    label: "Take profit",
    numeric: true,
    inStack: false,
    render: (p) => <span className="pass-num">{fmt(p.takeProfit)}</span>,
  },
  {
    key: "sl",
    label: "Stop loss",
    numeric: true,
    inStack: false,
    render: (p) => <span className="pass-num">{fmt(p.stopLoss)}</span>,
  },
];

export function TraderProfileClient({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [passes, setPasses] = useState<PassSummary[]>([]);
  const [perf, setPerf] = useState<TraderPerformance | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setError(undefined);
    setPerf(null);
    try {
      const p = await clientGet<Profile>(`/api/v1/profiles/${slug}`);
      setProfile(p);
      try {
        // /api/v1/profiles/{slug}/passes — the real route. The previous
        // /api/v1/passes?trader= does not exist and 404s, which made the Active
        // Passes section silently degrade to its empty state on every profile.
        const list = await clientGet<{ passes?: PassSummary[] }>(
          `/api/v1/profiles/${encodeURIComponent(slug)}/passes`,
        );
        setPasses(list.passes ?? []);
      } catch {
        // The Pass list is supplementary context. A failure to load it must not
        // take the identity surface down with it, so it degrades to empty.
        setPasses([]);
      }
      try {
        // Stage G metrics. Supplementary like the Pass list: a failure (or
        // an unexpected shape) keeps the legacy counts UI, never a crash.
        const raw = await clientGet<unknown>(
          `/api/v1/profiles/${encodeURIComponent(slug)}/performance`,
        );
        setPerf(isTraderPerformance(raw) ? raw : null);
      } catch {
        setPerf(null);
      }
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setState("error");
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <div className="pass-page">
        <main className="pass-shell">
          <div className="pass-shell-content">
            <LoadingBlock label="Loading profile" rows={4} />
          </div>
        </main>
      </div>
    );
  }

  if (state === "error" || !profile) {
    return (
      <div className="pass-page">
        <main className="pass-shell">
          <div className="pass-shell-content">
            <ErrorBlock
              title="This profile does not exist."
              detail={error}
              onRetry={load}
            />
          </div>
        </main>
      </div>
    );
  }

  const hasReputation =
    profile.reputation != null && profile.reputation.credibilityScore != null;

  // Single-state rule, AUTHOR side (lib/me.ts): this is a public view, so
  // nothing gates on the VIEWER. X-attributed UI renders only while the
  // AUTHOR is connected; a disconnected author's handle, address and
  // reputation hide while everything they published stays.
  const authorXLive =
    connectionByName(profile.connections, "x")?.connected === true;
  const authorEthosResolved =
    authorXLive &&
    connectionByName(profile.connections, "ethos")?.connected === true;
  const authorEthosVisible = authorEthosResolved && hasReputation;

  return (
    <div className="pass-page">
      <main className="pass-shell">
        <div className="pass-shell-content pass-stack pass-stack-6 pass-trader-profile">
          {/* ── §14.4 credential header ────────────────────────────────
              A credential, not a bio. The display name is the h1; the
              `@handle is / verified on PASS.` line is the §14.4 status form.

              The handle in the §14.4 line is deliberately split across two
              spans. One unsplit "@turnttfup99" node is asserted by the test,
              and a second unsplit copy here would make that assertion match
              two nodes and throw. Splitting also lets the trailing half carry
              the §14.4 label treatment. */}
          {/* §14.2 — the fourth and final corner-bracket frame in the product.
              Two went to Landing and one to /how-it-works; this spends the
              ration. A fifth anywhere would mean the ration stopped being a
              ration and became a border style. */}
          {/* ── Identity header + stat cards (ref 14) ────────────────────
              Ref 14 composes identity left, counters right: avatar, handle,
              title, bio and live-connection chips beside three stat cards
              bound to real PASS counters. Photo avatar, location/joined meta,
              follower counts, portfolio value + chart, period tabs and the
              side brand panel have no PASS counterpart and are dropped —
              never fabricated. The stat cards show profile counters only;
              computed figures (success, average R, realized) stay in the
              PASS performance panel below, so no figure renders twice. */}
          <CornerBracketFrame labelledBy="trader-credential">
          <header className="pass-detail-head" id="trader-credential">
            <div className="pass-profile-head">
              <Avatar
                handle={profile.xHandle ?? profile.handle ?? profile.displayName}
                size="lg"
              />
            <div className="pass-profile-identity">
            <span className="pass-numbered-eyebrow">
              <span className="pass-numbered-eyebrow-number">{"//"}</span>
              Trader profile
            </span>
            <h1 className="pass-display">{profile.displayName}</h1>
            {/* The handle here is a bare TEXT NODE, not its own element, and the
                trailing " is" is part of the same node. That is deliberate: two
                exact-text queries are asserted on this screen — `@turnttfup99`
                (from `HandleBlock`) and bare `turnttfup99` (the route slug
                below). Any element whose text is exactly one of those strings
                would make those queries match twice and throw. Folding the
                trailing word into the same text node keeps this line from
                matching either. */}
            <p className="pass-display-line pass-display-sub">
              <span>
                <span aria-hidden="true">@</span>
                {profile.handle} is
              </span>
              <span>
                <span className="pass-display-accent">verified</span> on PASS
              </span>
            </p>

            <div className="pass-detail-actions">
              <HandleBlock
                handle={profile.handle}
                xUrl={
                  authorXLive && profile.xHandle ? `https://x.com/${profile.xHandle}` : null
                }
              />
              {/* Only live connections render. A disconnected entry is
                  hidden, not shown as "not connected" — on someone else's
                  public profile a dead chip is noise, not information. */}
              {profile.connections?.length
                ? profile.connections
                    .filter((c) => c.connected)
                    .map((c) => (
                      <span
                        key={c.provider}
                        className="pass-chip"
                        data-state="active"
                      >
                        {c.label}
                      </span>
                    ))
                : null}
            </div>

            {profile.bio ? <p className="pass-thesis">{profile.bio}</p> : null}
            </div>
          </div>

          <StatRow>
            <StatBlock
              label="Active passes"
              value={profile.activePassCount ?? "—"}
              caption="Right now"
            />
            <StatBlock
              label="Published"
              value={profile.publishedPassCount ?? "—"}
              caption="All time"
            />
            <StatBlock
              label="Success"
              value={
                perf?.passSuccessMetric === null ||
                perf?.passSuccessMetric === undefined
                  ? "—"
                  : `${perf.passSuccessMetric}%`
              }
              caption="TP / completed · All time"
            />
          </StatRow>
          </header>
          </CornerBracketFrame>

          {/* ── §14.4 Ethos card ──────────────────────────────────────
              Reputation FIRST on a profile, so the reader knows whose
              credential they are reading before seeing what they published.

              A §14.3 `DataCard` is deliberately NOT used here. Its mandatory
              `value` slot is a big figure at --type-data-xl, and the only big
              figure this card has — the credibility score — is already owned by
              `ReputationBlock`. Filling the slot with the score would print it
              twice on one card, which is the §11.4 merge; filling it with
              anything else would set a sentence at 2.5rem. A `Panel` gives the
              same hairline frame with no figure slot to misuse.

              Single-state rule: the card renders only while the AUTHOR's
              Ethos is resolved (X live AND Ethos connected). A disconnected
              author's reputation hides with the rule that divided it —
              published passes and PASS-owned counters below stay. Resolved
              but scoreless keeps the existing UnavailableBlock: no response
              is not the same claim as no reputation. */}
          {authorEthosResolved ? (
          <Panel className="pass-data-card">
            {authorEthosVisible ? (
              <ReputationBlock
                score={profile.reputation?.credibilityScore ?? null}
                reviewsCount={profile.reputation?.reviewsCount}
                vouchesCount={profile.reputation?.vouchesCount}
                humanVerified={profile.reputation?.humanVerified}
              />
            ) : (
              <UnavailableBlock
                provider="Ethos"
                detail="No Ethos profile resolved for this handle. This does not mean the trader lacks a reputation."
              />
            )}
          </Panel>
          ) : null}

          {/* MANDATORY when both blocks render. D-007 / PRD §12 make adjacency
              without a rule between these two blocks wrong. */}
          {authorEthosResolved ? (
          <Rule label="End of PASS performance" />
          ) : null}

          {/* ── PASS performance card ──────────────────────────
              Computed figures only (success lives in the stat row above,
              published/active/completed counts beside it): success, average
              R and realized render solely when the performance route
              computed them; otherwise the omission note below stands. */}
          <Panel className="pass-data-card">
            <PerformanceBlock
              completedPassCount={profile.completedPassCount}
              averageRMultiple={perf?.averageRMultiple ?? undefined}
              totalRealizedPnl={numOrUndef(perf?.totalRealizedPnl)}
            />
            {perf ? (
              <>
                {perf.simulated === null ? (
                  <p className="pass-stale">No completed Passes yet.</p>
                ) : null}
              </>
            ) : (
              <p className="pass-stale">
                Win rate, average R and TP-hit rate are not reported by the PASS
                API for this account yet, so they are omitted rather than
                estimated.
              </p>
            )}
          </Panel>

          {/* ── Passes table (ref 14 activity) ─────────────────────────
              Ref 14 lists activity as a ruled table: identity, status,
              plan levels, link. Thumbnails, timestamps and value columns
              have no counterpart in this endpoint's rows and are dropped.
              The shared DataTable primitive (wide table, stacked list under
              720px, no sideways scroll) carries it, so each row links once
              and never nests anchors. */}
          <section className="pass-section" aria-labelledby="passes-h">
            <span className="pass-numbered-eyebrow" id="passes-h">
              <span className="pass-numbered-eyebrow-number">{"//"}</span>
              Passes
            </span>
            {passes.length === 0 ? (
              <EmptyBlock
                title="No active Passes"
                action={
                  <Link href="/passes/new" style={{ textDecoration: "none" }}>
                    <Button variant="primary" size="md">
                      Create a Pass
                    </Button>
                  </Link>
                }
              >
                {profile.displayName} has nothing live right now.
              </EmptyBlock>
            ) : (
              <Panel>
                <DataTable
                  caption={`Passes by ${profile.displayName}`}
                  columns={passTableColumns}
                  rows={passes}
                  rowKey={(p) => p.publicId}
                />
              </Panel>
            )}
          </section>

          {/* The route the extension emits (D-019.3). Kept as a plain datum
              because it is a URL convention, not trader performance. */}
          <StatBlock
            label="Profile slug"
            value={profile.slug}
            caption="Public URL convention per D-019.3"
          />
        </div>
      </main>
    </div>
  );
}