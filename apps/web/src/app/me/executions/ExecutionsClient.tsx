"use client";

/**
 * Executions (§10.9) — auditability (PRD §15, D-008), laid out after
 * reference 16: hero, 24H / 7D / 30D / ALL period selector, table,
 * pagination.
 *
 * Reference 16 is PASS-branded and matched directly. PARTIALLY FILLED is
 * deliberately NOT rendered: no provider status in apps/api produces it, so
 * inventing the chip would claim a state the reconciler never writes. ENTRY
 * FILL renders what GET /api/v1/me/executions returns — today that mapping
 * carries no fill, so the column reads "—" until the mapping grows it. Both
 * gaps are reported, not filled with invention.
 *
 * Same pattern as §10.8: `useAuthenticatedResource` + `AuthenticatedView`, so
 * every state is a value.
 *
 * Spec points encoded here:
 *  - `PnlCell` carries sign and colour TOGETHER (§10.9.1, §9.4);
 *  - expanding a row reveals the provider order id and the referenced Pass
 *    VERSION (§10.9.2). The version is not decoration: without it an execution
 *    cannot be reconstructed against the plan text that was actually live, which
 *    is the whole auditability requirement;
 *  - the period control is a `SegmentedControl` whose window comes from
 *    `periodWindow` — one helper, half-open `[start, end)`, offset from now, so
 *    the default window never goes stale (§10.9.3, skill §9 rule 2);
 *  - every simulated row carries the SIMULATED label in the same view
 *    (invariant 10);
 *  - the row Detail control is a button, never a link: rows carry no links,
 *    so anchors never nest.
 *
 * The window is applied client-side because `/me/executions` does not document a
 * time-range query parameter; the convention is still owned by `period.ts`, so
 * moving the filter server-side later is a change in one place.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { SignInXButton } from "@/components/SignInX";
import { onMeChanged } from "@/lib/me-events";
import { isXLive } from "@/lib/me";
import { useMePayload } from "@/lib/use-me";
import { Address, EmptyBlock, Timestamp } from "@/components/wave3/data";
import { DataCell, PnlCell, PriceCell, Tag } from "@/components/wave3/cells";
import { DataTable, type DataTableColumn } from "@/components/wave3/table";
import {
  DisplayHeadline,
  NumberedEyebrow,
  Surface,
} from "@/components/reference";
import { paginate, Pager } from "@/components/wave3/pager";
import { Inline, PageShell, Panel, ShellContent, Stack } from "@/components/wave1/layout";
import { SegmentedControl } from "@/components/wave2/controls";
import { fmtPrice, fmtSize, formatRelative, statusLabel } from "@/lib/format";
import { PERIODS, inWindow, periodWindow, type PeriodId } from "@/lib/period";
import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";

export interface Execution {
  id: string;
  passId: string;
  passVersion: number;
  providerOrderId: string | null;
  providerStatus: string;
  status: string;
  /** True when the execution was simulated in mock mode. Never a real trade. */
  simulated?: boolean;
  asset?: string;
  direction?: string;
  positionSize: string;
  entryFill?: string | null;
  realizedPnl: string | null;
  createdAt: string;
}

async function fetchExecutions(): Promise<Execution[]> {
  const res = await fetch("/api/v1/me/executions?limit=100", { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const body = (await res.json()) as { executions?: Execution[] };
  return body.executions ?? [];
}

const COLUMNS: DataTableColumn<Execution>[] = [
  {
    key: "pass",
    label: "PASS",
    render: (e) => (
      <DataCell>
        {e.asset ? `${e.asset} ${e.direction ?? ""}`.trim() : e.passId.slice(0, 8)}
      </DataCell>
    ),
  },
  {
    key: "size",
    label: "SIZE",
    numeric: true,
    render: (e) => <PriceCell value={fmtSize(e.positionSize)} />,
  },
  {
    key: "fill",
    label: "ENTRY FILL",
    numeric: true,
    inStack: false,
    render: (e) => <PriceCell value={fmtPrice(e.entryFill)} />,
  },
  {
    key: "status",
    label: "STATUS",
    render: (e) => (
      <DataCell>
        {statusLabel(e.status)}
        {e.simulated || e.providerOrderId?.startsWith("mock_") ? " — SIMULATED" : ""}
      </DataCell>
    ),
  },
  {
    key: "pnl",
    label: "REALIZED PNL",
    numeric: true,
    render: (e) => <PnlCell value={e.realizedPnl} />,
  },
  {
    key: "when",
    label: "WHEN",
    render: (e) => <Timestamp value={e.createdAt} relative={formatRelative(e.createdAt)} />,
  },
];

export function ExecutionsClient({
  probe,
  load = fetchExecutions,
  onNavigate,
}: {
  probe?: () => Promise<boolean>;
  load?: () => Promise<Execution[]>;
  /** Injectable navigation for the signed-out CTA (jsdom has no navigation). */
  onNavigate?: (url: string) => void;
}) {
  const [period, setPeriod] = useState<PeriodId>("7d");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { state, reload } = useAuthenticatedResource<Execution[]>({
    probe,
    load,
    isEmpty: (d) => d.length === 0,
  });
  // Re-read when another surface mutates connection state (Bug 2a).
  useEffect(() => onMeChanged(reload), [reload]);
  // Single-state rule, D-023: identity is X-only. Null `me`
  // is fail-open — the probe already proved the session.
  const { me } = useMePayload();

  return (
    <PageShell>
      <ShellContent>
      {/* Hero: eyebrow, three-line headline, support line, period selector.
          The selector sits right of the headline on wide viewports (as in
          the reference) and wraps below it on narrow ones. */}
      <Surface strength="section">
        <Stack gap="5">
          <NumberedEyebrow label="Executions" />
          <div className="pass-hero-split">
            <DisplayHeadline
              lines={[
                [{ text: "Executions." }],
                [{ text: "Every" }, { text: "fill" }, { text: "against" }, { text: "your" }, { text: "own" }, { text: "account," }],
                [{ text: "in" }, { text: "review", accent: true }, { text: "order.", accent: true }],
              ]}
            />
            {/* §10.9.3: one period control, one window convention. */}
            <SegmentedControl
              label="Period"
              options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
              value={period}
              onChange={(p) => {
                setPeriod(p);
                setPage(1);
              }}
            />
          </div>
          <p className="pass-stale">
            Here you can see all executions from your passes, including entry,
            details, status and realized PnL.
          </p>
        </Stack>
      </Surface>

      <AuthenticatedView
        state={state}
        loadingLabel="Loading your executions"
        unauthorizedReason="Your execution history belongs to a connected account."
        unauthorizedAction={<SignInXButton onNavigate={onNavigate} />}
        empty={
          <EmptyBlock title="No executions yet">
            Take a Pass to record an execution against your own Hyperliquid account.
          </EmptyBlock>
        }
        onRetry={reload}
      >
        {(all) => {
          const window = periodWindow(period);
          const rows = all.filter((e) => inWindow(e.createdAt, window));
          const gated = me !== null && !isXLive(me);
          if (gated) {
            return (
              <Panel>
                <h2 style={{ fontSize: "var(--type-title-s-size)" }}>
                  Connect an account to see your executions.
                </h2>
                <p className="pass-stale">
                  Your executions are safe — link an identity to read them.
                </p>
                <Inline gap="3">
                  <Link className="pass-btn" data-variant="primary" href="/onboarding">
                    Connect an account
                  </Link>
                </Inline>
              </Panel>
            );
          }

          const pageWindow = paginate(rows, page, "executions");

          return (
            <Stack gap="6">
              {rows.some(
                (e) => e.simulated || e.providerOrderId?.startsWith("mock_"),
              ) ? (
                <Panel>
                  <p className="pass-stale">
                    Some executions below are simulated for demo purposes.
                    They are labelled.
                  </p>
                </Panel>
              ) : null}

              {rows.length === 0 ? (
                <EmptyBlock title="Nothing in this period">
                  Widen the period to see earlier executions.
                </EmptyBlock>
              ) : (
                <Panel>
                  <DataTable
                    caption="Your executions"
                    columns={COLUMNS}
                    rows={pageWindow.pageRows}
                    rowKey={(e) => e.id}
                    isExpanded={(e) => expanded === e.id}
                    renderRow={(e) => (
                      <>
                        <td className="pass-table-cell">
                          <button
                            type="button"
                            className="pass-btn"
                            data-variant="ghost"
                            aria-expanded={expanded === e.id}
                            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          >
                            {expanded === e.id ? "Hide detail" : "Detail"}
                          </button>
                        </td>
                        {COLUMNS.map((c) => (
                          <td
                            key={c.key}
                            className={c.numeric ? "pass-num pass-table-cell" : "pass-table-cell"}
                            data-align={c.numeric ? "right" : "left"}
                          >
                            {c.render(e)}
                          </td>
                        ))}
                      </>
                    )}
                    /* §10.9.2 reconstructability: provider order id AND the Pass
                     * version that was live when this executed. */
                    renderDetail={(e) => (
                      <Inline gap="6" wrap>
                        <DataCell tone="muted">Provider order</DataCell>
                        <Tag title={e.providerOrderId ?? undefined}>
                          {e.providerOrderId ?? "not assigned"}
                          {e.simulated || e.providerOrderId?.startsWith("mock_")
                            ? " — SIMULATED"
                            : ""}
                        </Tag>
                        <DataCell tone="muted">Pass version</DataCell>
                        <Tag>v{e.passVersion}</Tag>
                        <DataCell tone="muted">Pass</DataCell>
                        <Address value={e.passId} />
                        <DataCell tone="muted">Provider status</DataCell>
                        <DataCell>{e.providerStatus}</DataCell>
                      </Inline>
                    )}
                  />
                  <Pager
                    page={pageWindow.page}
                    pageCount={pageWindow.pageCount}
                    summary={pageWindow.summary}
                    onPage={setPage}
                  />
                </Panel>
              )}
            </Stack>
          );
        }}
      </AuthenticatedView>
      </ShellContent>
    </PageShell>
  );
}
