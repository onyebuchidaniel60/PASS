"use client";

/**
 * Discover — design/DESIGN.md §10.2, docs/UX_SPEC.md.
 *
 * Purpose: let a visitor find a Pass worth opening. The list is the content;
 * filters and the count are context.
 *
 * Row anatomy is fixed by §10.2 and is the part worth stating, because it
 * encodes a product rule: DirectionBadge → asset → StatusChip → entry/TP/SL →
 * relative publish time, and **trades performance metrics**. The user has taken
 * nothing, and PASS does not imply that account performance proves Pass
 * performance (PRD §13). A Discover row showing PnL would be a synthetic-trust
 * anti-pattern (§12.3).
 *
 * Filters are a SegmentedControl row, always visible, never behind a menu (§10.2).
 * The route is GET /api/v1/discover?limit=&status= — it supports a status filter
 * and a limit but no cursor, so no pagination control is invented.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Inline,
  PageShell,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import { CoordinatePair } from "@/components/wave1/signature";
import {
  Button,
  SegmentedControl,
  type SegmentedOption,
} from "@/components/wave2/controls";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  StatusChip,
  type PassLifecycle,
} from "@/components/wave3/data";

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
}

type StatusFilter = "all" | "active" | "open";

const STATUS_OPTIONS: readonly SegmentedOption<StatusFilter>[] = [
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

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          <Section label="Discover">
            <h1 className="pass-asset-line">Explore Passes</h1>

            {/* §10.2 item 2 — filters always visible, never behind a menu. */}
            <Inline gap="3" style={{ marginBlockStart: "var(--space-4)" }}>
              <SegmentedControl
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                label="Filter by status"
              />
            </Inline>

            {/* §10.2 item 3 — a mono count so the list is self-describing when
                short. */}
            <p className="pass-stale" style={{ marginBlockStart: "var(--space-3)" }}>
              {state === "ready"
                ? `${visible.length} ${visible.length === 1 ? "Pass" : "Passes"}`
                : "Counting…"}
            </p>
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
                <Link href="/passes/new" style={{ textDecoration: "none" }}>
                  <Button variant="primary" size="md">
                    Create a Pass
                  </Button>
                </Link>
              }
            >
              Nothing is published under this status right now.
            </EmptyBlock>
          ) : (
            <div>
              {visible.map((p) => (
                <Link
                  key={p.publicId}
                  href={p.canonicalPath || `/p/${p.publicId}`}
                  className="pass-row-link"
                >
                  <Stack gap="2">
                    <Inline gap="3">
                      <span className="pass-chip" data-state="active">
                        {p.direction === "long" ? "Long" : "Short"}
                      </span>
                      {/* §11.2 asset in the Display face, title-m sized. */}
                      <span
                        style={{
                          fontFamily: "var(--type-title-m-font)",
                          fontSize: "var(--type-title-m-size)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {p.asset}
                      </span>
                      <StatusChip state={p.status} />
                      <span className="pass-stale">{relative(p.publishedAt)}</span>
                    </Inline>
                    <Inline gap="4">
                      <CoordinatePair label="Entry" value={fmt(p.entryPrice)} />
                      <CoordinatePair label="TP" value={fmt(p.takeProfit)} />
                      <CoordinatePair label="SL" value={fmt(p.stopLoss)} />
                    </Inline>
                  </Stack>
                </Link>
              ))}
            </div>
          )}
        </Stack>
      </ShellContent>
    </PageShell>
  );
}