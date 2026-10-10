"use client";

/**
 * My Passes (§10.8) — the Trader's own inventory.
 *
 * Built on `useAuthenticatedResource` + `AuthenticatedView`, so all five states
 * are a state VALUE rendered by a pure view. The unauthorized branch is reached
 * by resolving false from the injected probe in tests, never by rejecting a
 * mocked client — that rejection failed the whole test file and blocked this
 * screen across three sessions.
 *
 * Spec points encoded here:
 *  - lifecycle counts are mono and NOT colour coded (§10.8.1);
 *  - draft and cancelled rows are `ghost`, dimmed at row level, never as
 *    reduced text opacity, which would break contrast;
 *  - no horizontal scroller — the table stacks instead, because expiry is the
 *    last column and a sideways scroll hides it;
 *  - `Create a Pass` is accent-filled and sits in the section header.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { SignInXButton } from "@/components/SignInX";
import { Button } from "@/components/wave2/controls";
import { Dialog } from "@/components/wave5/Dialog";
import { onMeChanged } from "@/lib/me-events";
import { clientPost } from "@/lib/client";
import { isXLive } from "@/lib/me";
import { useMePayload } from "@/lib/use-me";
import {
  EmptyBlock,
  LIFECYCLE_LABEL,
  StatBlock,
  StatusChip,
  type PassLifecycle,
} from "@/components/wave3/data";
import { DataTable, StatRow, type DataTableColumn } from "@/components/wave3/table";
import { Inline, PageShell, Panel, Section, Stack } from "@/components/wave1/layout";
import { fmtPrice, formatRelative } from "@/lib/format";
import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";

export interface MyPass {
  id: string;
  publicId: string;
  version: number;
  status: PassLifecycle;
  asset: string;
  direction: string;
  entryPrice: string | null;
  takeProfit: string | null;
  stopLoss: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  takerCount?: number;
}

/** Draft and cancelled are not live inventory; they are ghosted, not hidden. */
const GHOST = new Set<PassLifecycle>(["draft", "cancelled"]);

/** Server allows edits while draft, active or entry_pending. */
const EDITABLE = new Set<PassLifecycle>(["draft", "active", "entry_pending"]);
/** The state machine allows cancel from active or entry_pending only. */
const CANCELLABLE = new Set<PassLifecycle>(["active", "entry_pending"]);

/**
 * Counts are over the REAL lifecycle states, not invented buckets: an author
 * needs to see which Passes are waiting on entry versus genuinely open, so
 * collapsing those together would hide the number they are looking for.
 */
const SUMMARY = Object.keys(LIFECYCLE_LABEL) as PassLifecycle[];

async function fetchPasses(): Promise<MyPass[]> {
  const res = await fetch("/api/v1/me/passes?limit=100", { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as { passes?: MyPass[] };
  return body.passes ?? [];
}

function passColumns(onCancel: (id: string) => void): DataTableColumn<MyPass>[] {
  return [
  {
    key: "asset",
    label: "PASS",
    render: (p) => (
      <Inline gap="2">
        <strong>{p.asset}</strong>
        <span className="pass-stale">{p.direction}</span>
      </Inline>
    ),
  },
  {
    key: "status",
    label: "STATUS",
    render: (p) => <StatusChip state={p.status} />,
  },
  {
    key: "entry",
    label: "ENTRY",
    numeric: true,
    inStack: false,
    render: (p) => <span className="pass-num">{fmtPrice(p.entryPrice)}</span>,
  },
  {
    key: "takers",
    label: "TAKERS",
    numeric: true,
    render: (p) => <span className="pass-num">{p.takerCount ?? 0}</span>,
  },
  {
    key: "published",
    label: "PUBLISHED",
    render: (p) =>
      p.publishedAt ? (
        <span className="pass-num">{formatRelative(p.publishedAt)}</span>
      ) : (
        <span className="pass-stale">—</span>
      ),
  },
  {
    key: "expiry",
    label: "EXPIRY",
    render: (p) =>
      p.expiresAt ? (
        <span className="pass-num">{formatRelative(p.expiresAt)}</span>
      ) : (
        <span className="pass-stale">—</span>
      ),
  },
  {
    // Author-only by construction: this list holds the viewer's own passes.
    // Edit reuses the Create form (?edit={id}); Cancel confirms, then the
    // row reloads as cancelled and both controls disappear with the state.
    key: "actions",
    label: "ACTIONS",
    render: (p) => (
      <Inline gap="2">
        {EDITABLE.has(p.status) ? (
          <Link href={`/passes/new?edit=${p.id}`} className="pass-link-btn">
            Edit
          </Link>
        ) : null}
        {CANCELLABLE.has(p.status) ? (
          <Button variant="destructive" size="sm" onClick={() => onCancel(p.id)}>
            Cancel
          </Button>
        ) : null}
      </Inline>
    ),
  },
  ];
}

export function MyPassesClient({
  probe,
  load = fetchPasses,
  onNavigate,
}: {
  probe?: () => Promise<boolean>;
  load?: () => Promise<MyPass[]>;
  /** Injectable navigation for the signed-out CTA (jsdom has no navigation). */
  onNavigate?: (url: string) => void;
}) {
  const { state, reload } = useAuthenticatedResource<MyPass[]>({
    probe,
    load,
    isEmpty: (d) => d.length === 0,
  });
  // Re-read when another surface mutates connection state (Bug 2a).
  useEffect(() => onMeChanged(reload), [reload]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function confirmCancel() {
    if (!confirmId || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await clientPost(`/api/v1/passes/${confirmId}/cancel`);
      setConfirmId(null);
      reload();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setCancelError(
        `Cancel failed${code ? ` (${code})` : ""}: ${
          e instanceof Error ? e.message : "Could not cancel this Pass."
        }`,
      );
    } finally {
      setCancelling(false);
    }
  }
  // Single-state rule, D-023: identity is X-only. The lists belong to the
  // session's user, but nothing account-attributed displays while X is
  // disconnected. `me` null is fail-open — the probe already proved the
  // session, so an unreadable snapshot must not hide the user's passes.
  const { me } = useMePayload();

  return (
    <PageShell>
      <Section label="My Passes">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "4",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1>My Passes</h1>
            <p className="pass-stale">Passes you have authored, with their state.</p>
          </div>
          <Link href="/passes/new" className="pass-btn" data-variant="primary">
            Create a Pass
          </Link>
        </div>
      </Section>

      <AuthenticatedView
        state={state}
        loadingLabel="Loading your Passes"
        unauthorizedReason="Your Passes belong to a connected X identity."
        unauthorizedAction={<SignInXButton onNavigate={onNavigate} />}
        empty={
          <EmptyBlock title="No Passes yet" action="Create a Pass">
            Author one and it appears here with its live state.
          </EmptyBlock>
        }
        onRetry={reload}
      >
        {(passes) => {
          const gated = me !== null && !isXLive(me);
          if (gated) {
            return (
              <Panel>
                <h2 style={{ fontSize: "var(--type-title-s-size)" }}>
                  Connect an account to see your passes.
                </h2>
                <p className="pass-stale">
                  Your Passes are safe — link an identity to read them.
                </p>
                <Inline gap="3">
                  <Link className="pass-btn" data-variant="primary" href="/onboarding">
                    Connect an account
                  </Link>
                </Inline>
              </Panel>
            );
          }
          return (
          <Stack gap="6">
            {/* §10.8.1 counts are mono and carry no colour coding. */}
            <StatRow>
              {SUMMARY.map((s) => (
                <StatBlock
                  key={s}
                  label={LIFECYCLE_LABEL[s]}
                  value={String(passes.filter((p) => p.status === s).length)}
                />
              ))}
            </StatRow>

            <Panel>
              <DataTable
                caption="Passes you have authored"
                columns={passColumns(setConfirmId)}
                rows={passes}
                rowKey={(p) => p.id}
                isGhost={(p) => GHOST.has(p.status)}
              />
            </Panel>
            <Dialog
              open={confirmId !== null}
              onClose={() => {
                if (!cancelling) {
                  setConfirmId(null);
                  setCancelError(null);
                }
              }}
              title="Cancel this Pass?"
              action={
                <Inline gap="3">
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={confirmCancel}
                    disabledReason={cancelling ? "Cancelling…" : undefined}
                  >
                    Confirm cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setConfirmId(null);
                      setCancelError(null);
                    }}
                  >
                    Keep Pass
                  </Button>
                </Inline>
              }
            >
              <p style={{ maxWidth: "var(--measure-body)" }}>
                This is terminal. A cancelled Pass accepts no new executions
                and never returns to active.
              </p>
              {cancelError ? (
                <p className="pass-validation" role="alert">
                  {cancelError}
                </p>
              ) : null}
            </Dialog>
          </Stack>
          );
        }}
      </AuthenticatedView>
    </PageShell>
  );
}