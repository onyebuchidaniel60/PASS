"use client";

/**
 * My Passes (§10.8) — the Trader's own inventory, laid out after
 * reference 15: hero, full-lifecycle status strip, ACTIVE / ALL PASSES tab
 * bar, table, pagination.
 *
 * Reference 15 is PASS-branded and matched directly. The single DROP is the
 * row thumbnail: PASS passes carry no image. Columns are PASS's own
 * (PASS / STATUS / ENTRY / TAKERS / FEES / PUBLISHED / EXPIRY / ACTIONS).
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
 *  - `Create a Pass` is accent-filled and sits in the section header;
 *  - exactly one link per table row (Edit); Cancel is a button, never a link,
 *    so rows never nest anchors.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { SignInXButton } from "@/components/SignInX";
import { Button, SegmentedControl } from "@/components/wave2/controls";
import { Dialog } from "@/components/wave5/Dialog";
import { onMeChanged } from "@/lib/me-events";
import { clientPost } from "@/lib/client";
import { isXLive } from "@/lib/me";
import { useMePayload } from "@/lib/use-me";
import {
  EmptyBlock,
  LIFECYCLE_LABEL,
  StatusChip,
  type PassLifecycle,
} from "@/components/wave3/data";
import { DataTable, type DataTableColumn } from "@/components/wave3/table";
import {
  DisplayHeadline,
  MetricCard,
  NumberedEyebrow,
  Surface,
} from "@/components/reference";
import { paginate, Pager } from "@/components/wave3/pager";
import { Inline, PageShell, Panel, Section, ShellContent, Stack } from "@/components/wave1/layout";
import { fmtPrice, fmtUsd, formatRelative } from "@/lib/format";
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
  /** Summed simulated creator share from fee_ledger. Null when no takes. */
  feesEarnedUsd?: string | null;
}

/** Draft and cancelled are not live inventory; they are ghosted, not hidden. */
const GHOST = new Set<PassLifecycle>(["draft", "cancelled"]);

/** Server allows edits while draft, active or entry_pending. */
const EDITABLE = new Set<PassLifecycle>(["draft", "active", "entry_pending"]);
/** The state machine allows cancel from active or entry_pending only. */
const CANCELLABLE = new Set<PassLifecycle>(["active", "entry_pending"]);

/** The ACTIVE tab: live inventory (waiting on entry, open, or active). */
const ACTIVE_SET = new Set<PassLifecycle>(["active", "entry_pending", "open"]);

/**
 * Counts are over the REAL lifecycle states, not invented buckets: an author
 * needs to see which Passes are waiting on entry versus genuinely open, so
 * collapsing those together would hide the number they are looking for.
 */
const SUMMARY = Object.keys(LIFECYCLE_LABEL) as PassLifecycle[];

type PassTab = "active" | "all";

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
    // Builder fees accrued to the author (fee_ledger creator share, a
    // real on-chain builder fee). One line per row, in the row's own
    // numeric voice.
    key: "fees",
    label: "FEES",
    numeric: true,
    render: (p) => (
      <span className="pass-num">Fees earned: ${fmtUsd(p.feesEarnedUsd ?? "0")}</span>
    ),
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
    // Edit is the row's ONE link; Cancel is a button, so rows never nest
    // anchors and no per-row accent button exists.
    // gap-3 (12px): the row content and its actions must never touch —
    // the stacked ACTIONS row measured 8px before the density pass.
    key: "actions",
    label: "ACTIONS",
    render: (p) => (
      <Inline gap="3">
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

function PassInventory({ passes, onCancel }: { passes: MyPass[]; onCancel: (id: string) => void }) {
  const [tab, setTab] = useState<PassTab>("all");
  const [page, setPage] = useState(1);
  const filtered = tab === "active" ? passes.filter((p) => ACTIVE_SET.has(p.status)) : passes;
  const window = paginate(filtered, page, "passes");

  return (
    <Stack gap="6">
      {/* §10.8.1 counts are mono and carry no colour coding. The strip marks
          the states inside the current tab filter. */}
      <div className="pass-status-strip" data-testid="passes-status-strip">
        {SUMMARY.map((s) => (
          <MetricCard
            key={s}
            label={LIFECYCLE_LABEL[s]}
            value={String(passes.filter((p) => p.status === s).length)}
            selected={tab === "active" && ACTIVE_SET.has(s)}
          />
        ))}
      </div>

      <SegmentedControl
        label="Pass filter"
        options={[
          { value: "active" as PassTab, label: "Active" },
          { value: "all" as PassTab, label: "All passes" },
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPage(1);
        }}
      />

      {filtered.length === 0 ? (
        <EmptyBlock title={tab === "active" ? "No active passes" : "No Passes yet"}>
          {tab === "active"
            ? "Nothing is live right now. Switch tabs to see the rest of your inventory."
            : "Author one and it appears here with its live state."}
        </EmptyBlock>
      ) : (
        <Panel>
          <DataTable
            caption="Passes you have authored"
            columns={passColumns(onCancel)}
            rows={window.pageRows}
            rowKey={(p) => p.id}
            isGhost={(p) => GHOST.has(p.status)}
          />
          <Pager
            page={window.page}
            pageCount={window.pageCount}
            summary={window.summary}
            onPage={setPage}
          />
        </Panel>
      )}
    </Stack>
  );
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
    <PageShell className="pass-my-passes">
      <ShellContent>
      {/* Hero: eyebrow, two-line headline, support line, live count. */}
      <Surface strength="section">
        <Stack gap="5">
          <NumberedEyebrow label="My passes" />
          <div className="pass-hero-split">
            {/* `section`: the Discover hero size (see Settings hero note). */}
            <DisplayHeadline
              section
              lines={[
                [{ text: "Your" }, { text: "passes." }],
                [{ text: "All" }, { text: "in" }, { text: "one", accent: true }, { text: "place.", accent: true }],
              ]}
            />
          </div>
          <p className="pass-stale">
            Track the performance, status and lifecycle of all your passes.
            From active to completed, everything is here.
          </p>
        </Stack>
      </Surface>

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
            <h2>My Passes</h2>
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
          <>
            <PassInventory passes={passes} onCancel={setConfirmId} />
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
          </>
          );
        }}
      </AuthenticatedView>
      </ShellContent>
    </PageShell>
  );
}
