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

import { Button } from "@/components/wave2/controls";
import { Panel, Rule } from "@/components/wave1/layout";
import {
  Address,
  EmptyBlock,
  ErrorBlock,
  HandleBlock,
  LoadingBlock,
  PerformanceBlock,
  ReputationBlock,
  StatBlock,
  UnavailableBlock,
} from "@/components/wave3/data";
import {
  CornerBracketFrame,
  DataCard,
  type StatusTone,
} from "@/components/reference";

import { clientGet } from "@/lib/client";

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

export function TraderProfileClient({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [passes, setPasses] = useState<PassSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setError(undefined);
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

  return (
    <div className="pass-page">
      <main className="pass-shell">
        <div className="pass-shell-content pass-stack pass-stack-6">
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
          <CornerBracketFrame labelledBy="trader-credential">
          <header className="pass-detail-head" id="trader-credential">
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
                  profile.xHandle ? `https://x.com/${profile.xHandle}` : null
                }
              />
              {profile.connections?.length
                ? profile.connections.map((c) => (
                    <span
                      key={c.provider}
                      className="pass-chip"
                      data-state={c.connected ? "active" : "draft"}
                    >
                      {c.label}
                    </span>
                  ))
                : null}
            </div>

            {profile.bio ? <p className="pass-thesis">{profile.bio}</p> : null}

            {profile.hyperliquidAccountAddress ? (
              <p className="pass-stale">
                Hyperliquid <Address value={profile.hyperliquidAccountAddress} />
              </p>
            ) : null}
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
              same hairline frame with no figure slot to misuse. */}
          <Panel className="pass-data-card">
            {hasReputation ? (
              <ReputationBlock
                score={profile.reputation?.credibilityScore ?? null}
                reviewsCount={profile.reputation?.reviewsCount}
                vouchesCount={profile.reputation?.vouchesCount}
                humanVerified={profile.reputation?.humanVerified}
              />
            ) : (
              /* No Ethos data is a STATE, not a reason to remove the block.
                 Dropping the card would let a missing external response read
                 as "this trader has no reputation", which is a different and
                 much stronger claim. */
              <UnavailableBlock
                provider="Ethos"
                detail="No Ethos profile resolved for this handle. This does not mean the trader lacks a reputation."
              />
            )}
          </Panel>

          {/* MANDATORY. D-007 / PRD §12 make adjacency without a rule
              between these two blocks wrong. */}
          <Rule label="End of PASS performance" />

          {/* ── §14.4 PASS performance card ──────────────────────────
              PASS-owned counters only. Nothing here is derived from the
              trader's account, because a Taker's own fills are their own
              business (PRD §13). */}
          <Panel className="pass-data-card">
            <PerformanceBlock
              publishedPassCount={profile.publishedPassCount}
              completedPassCount={profile.completedPassCount}
              activePassCount={profile.activePassCount}
            />
            <p className="pass-stale">
              Win rate, average R and TP-hit rate are not reported by the PASS
              API for this account yet, so they are omitted rather than
              estimated.
            </p>
          </Panel>

          {/* ── §14.4 Active Passes ──────────────────────────────────
              §14.8 grid, §10.2 row anatomy: plan levels only, never
              outcome numbers attributed to a Pass the reader has not taken. */}
          <section className="pass-section" aria-labelledby="passes-h">
            <span className="pass-numbered-eyebrow">
              <span className="pass-numbered-eyebrow-number">{"//"}</span>
              Active Passes
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
              <div className="pass-cards-grid">
                {passes.map((p) => (
                  /* The whole card is the link: a target the size of a card is
                     what a reader aims at, and a small "View" affordance in the
                     corner of a grid is not. No nested action is passed to
                     DataCard, because an <a> inside an <a> is invalid and
                     breaks hydration. */
                  <Link
                    key={p.publicId}
                    href={`/p/${p.publicId}`}
                    className="pass-card-link"
                  >
                    <DataCard
                      id={p.publicId}
                      value={p.asset}
                      sub={p.direction === "long" ? "Long" : "Short"}
                      status={{
                        tone: toneFor(p.status),
                        label: p.status.replace(/_/g, " "),
                      }}
                    >
                      <dl className="pass-card-metrics">
                        <div className="pass-card-metric">
                          <dt>Entry</dt>
                          <dd>{fmt(p.entryPrice)}</dd>
                        </div>
                        <div className="pass-card-metric">
                          <dt>TP</dt>
                          <dd>{fmt(p.takeProfit)}</dd>
                        </div>
                        <div className="pass-card-metric">
                          <dt>SL</dt>
                          <dd>{fmt(p.stopLoss)}</dd>
                        </div>
                      </dl>
                      <span className="pass-row-arrow">View Pass</span>
                    </DataCard>
                  </Link>
                ))}
              </div>
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