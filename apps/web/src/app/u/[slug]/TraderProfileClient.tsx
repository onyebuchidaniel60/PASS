"use client";

/**
 * Trader profile — design/DESIGN.md §10.4, docs/UX_SPEC.md §6.
 *
 * Establish identity and credibility as a VERIFIED CREDENTIAL, not a social bio.
 *
 * The binding rule: PerformanceBlock and ReputationBlock are two visually and
 * structurally separate blocks with a mandatory Rule between them. Merging them
 * into one score, one label, or one card is a P0 anti-pattern (D-007, PRD §12).
 * That is asserted in the test, not merely documented here.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Inline,
  PageShell,
  Panel,
  Rule,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import { CoordinatePair, SignalLine } from "@/components/wave1/signature";
import { Button } from "@/components/wave2/controls";
import {
  Address,
  EmptyBlock,
  ErrorBlock,
  HandleBlock,
  LoadingBlock,
  PerformanceBlock,
  ReputationBlock,
  StatBlock,
  StatusChip,
} from "@/components/wave3/data";

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
        const list = await clientGet<{ passes?: PassSummary[] } | PassSummary[]>(
          `/api/v1/passes?trader=${encodeURIComponent(p.handle)}`,
        );
        setPasses(Array.isArray(list) ? list : (list.passes ?? []));
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
      <PageShell>
        <ShellContent>
          <LoadingBlock label="Loading profile" rows={4} />
        </ShellContent>
      </PageShell>
    );
  }

  if (state === "error" || !profile) {
    return (
      <PageShell>
        <ShellContent>
          <ErrorBlock title="This profile does not exist." detail={error} onRetry={load} />
        </ShellContent>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          {/* §10.4 item 1 — a credential block, not a profile card. */}
          <Section label="Trader identity">
            <h1 className="pass-asset-line">{profile.displayName}</h1>
            <Inline gap="3" style={{ marginBlockStart: "var(--space-3)" }}>
              <HandleBlock
                handle={profile.handle}
                xUrl={profile.xHandle ? `https://x.com/${profile.xHandle}` : null}
              />
            </Inline>
            {profile.bio ? <p className="pass-thesis">{profile.bio}</p> : null}
            {profile.connections?.length ? (
              <Inline gap="2" style={{ marginBlockStart: "var(--space-3)" }}>
                {/* Verification markers are attributed to the named source, never
                    synthesised by PASS (§12.3). */}
                {profile.connections.map((c) => (
                  <span
                    key={c.provider}
                    className="pass-chip"
                    data-state={c.connected ? "active" : "draft"}
                  >
                    {c.label}
                  </span>
                ))}
              </Inline>
            ) : null}
            {profile.hyperliquidAccountAddress ? (
              <span className="pass-stale" style={{ display: "block", marginBlockStart: "var(--space-2)" }}>
                Hyperliquid{" "}
                <Address value={profile.hyperliquidAccountAddress} />
              </span>
            ) : null}
          </Section>

          {/* §10.4 item 2 — trading FIRST, then the rule, then reputation. */}
          <Section label="Performance and reputation">
            <Panel>
              <Stack gap="5">
                <PerformanceBlock
                  publishedPassCount={profile.publishedPassCount}
                  completedPassCount={profile.completedPassCount}
                  activePassCount={profile.activePassCount}
                />

                {/* MANDATORY. D-007 / PRD §12 make adjacency without a rule
                    between these two blocks wrong. */}
                <Rule label="End of PASS performance" />

                <ReputationBlock
                  score={profile.reputation?.credibilityScore ?? null}
                  reviewsCount={profile.reputation?.reviewsCount}
                  vouchesCount={profile.reputation?.vouchesCount}
                  humanVerified={profile.reputation?.humanVerified}
                />
              </Stack>
            </Panel>
          </Section>

          {/* §10.4 item 3 — active Passes, reusing the Discover row anatomy. */}
          <Section label="Active Passes">
            <SignalLine />
            <div style={{ marginBlockStart: "var(--space-4)" }}>
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
                <div>
                  {passes.map((p) => (
                    <Link
                      key={p.publicId}
                      href={`/p/${p.publicId}`}
                      className="pass-row-link"
                    >
                      <Inline gap="3">
                        <span className="pass-value">{p.asset}</span>
                        <span className="pass-chip" data-state="active">
                          {p.direction === "long" ? "Long" : "Short"}
                        </span>
                        <StatusChip state={p.status as never} />
                        <CoordinatePair label="Entry" value={fmt(p.entryPrice)} />
                        <CoordinatePair label="TP" value={fmt(p.takeProfit)} />
                        <CoordinatePair label="SL" value={fmt(p.stopLoss)} />
                      </Inline>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <StatBlock
            label="Profile slug"
            value={profile.slug}
            caption="Public URL convention per D-019.3"
          />
        </Stack>
      </ShellContent>
    </PageShell>
  );
}
