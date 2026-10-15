"use client";

/**
 * Profile and connections (§10.10) — the Trader's own settings,
 * laid out after reference 14 (identity header, three-counter stat band,
 * realized-PnL panel with sparkline and period tabs, two metric sub-cards,
 * slogan rail, section tab bar, recent-activity table).
 *
 * Reference 14 is TONNE-branded; every slot is SUBSTITUTED with PASS's own
 * content (see the mapping in the phase report). The single DROP is the row
 * thumbnail: PASS executions have no image.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 * AGENTS.md is a design constraint here, not just an engineering one: **no field
 * in this screen displays, requests, echoes or stores a seed phrase, a master
 * private key, or an agent private key.** The agent key is generated and held on
 * the client only; the server never receives it. So there is no key field, no
 * "paste your private key", and no secret preview. A field that would accept one
 * does not exist in this screen and must not be added to it.
 *
 * Connection state is SINGLE-valued per account (lib/me.ts): a section
 * renders only while its account is connected, otherwise its connect CTA
 * renders. There are no "linked but inactive" states and no actions on
 * connected chips — the chip IS the state.
 *
 * Wallet (D-023): the linked execution wallet is managed HERE and only here.
 * It is not identity — it never appears on the public Trader profile
 * (/u/{slug}) or the topbar, and it never appears in the identity header
 * above — but the user must be able to see and swap the wallet their account
 * executes with, so Settings owns connect / reconnect / unlink. Only the
 * address ever crosses the wire (D-018.9).
 *
 * Sign-out lives in the topbar X menu (D-024). It is never added here.
 *
 * Ethos score: read from GET /api/v1/integrations/ethos/me (real value
 * only). /me carries no score and is never forked for one (invariant 5).
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectKitButton } from "connectkit";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { notifyMeChanged, onMeChanged } from "@/lib/me-events";
import {
  connectionByName,
  isEthosVisible,
} from "@/lib/me";
import { clientDelete, clientGet, clientPatch, clientPost } from "@/lib/client";
import { fmtSize, formatRelative, statusLabel, truncateAddress } from "@/lib/format";
import { PERIODS, inWindow, periodWindow, type PeriodId } from "@/lib/period";
import { SignInXButton } from "@/components/SignInX";
import { Field, SegmentedControl, Textarea, TextInput, ValidationMessage } from "@/components/wave2/controls";
import { Avatar, ConnectionChip } from "@/components/wave3/identity";
import { EmptyBlock, ErrorBlock, LoadingBlock, Pnl, Timestamp } from "@/components/wave3/data";
import { DataCell, PnlCell, PriceCell } from "@/components/wave3/cells";
import {
  ChipBar,
  ChipButton,
  DataCard,
  DisplayHeadline,
  MetricCard,
  MetricCardRow,
  NumberedEyebrow,
  Sparkline,
  Surface,
} from "@/components/reference";
import { Inline, PageShell, Panel, Section, ShellContent, Stack } from "@/components/wave1/layout";
import { DataTable, type DataTableColumn } from "@/components/wave3/table";
import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";

export interface Connection {
  provider: string;
  connected: boolean;
  label: string;
  displayOnly: boolean;
}

export interface Me {
  userId: string;
  profileSlug: string | null;
  displayName: string | null;
  bio?: string | null;
  handle?: string | null;
  connections: Connection[];
  tradingAccounts: {
    id: string;
    accountAddress: string;
    agentAddress: string | null;
    isPrimary: boolean;
  }[];
  demoMode: boolean;
}

/** The slice of GET /api/v1/me/passes this screen counts. No shape change. */
export interface SettingsPass {
  id: string;
  status: string;
}

/** The slice of GET /api/v1/me/executions this screen aggregates. */
export interface SettingsExecution {
  id: string;
  passId: string;
  passVersion: number;
  providerOrderId: string | null;
  providerStatus: string;
  simulated?: boolean;
  status: string;
  positionSize: string;
  asset?: string;
  direction?: string;
  realizedPnl: string | null;
  createdAt: string;
}

/** GET /api/v1/integrations/ethos/me. Real value or null, never mocked. */
export interface SettingsEthos {
  providerProfileId: string | null;
  credibilityScore: number | null;
  reviewsCount: number | null;
  vouchesCount: number | null;
  humanVerified: boolean | null;
  sourceUrl: string | null;
  syncedAt: string | null;
}

/** GET /api/v1/profiles/:slug/performance. PASS-owned figures only (D-014). */
export interface SettingsPerformance {
  slug: string;
  publishedPasses: number;
  completedPasses: number;
  passSuccessMetric: number | null;
  successMetricWindow: string;
  averageRMultiple: number | null;
  totalRealizedPnl: string | null;
  simulated: boolean | null;
}

export interface SettingsExtra {
  passes: SettingsPass[];
  executions: SettingsExecution[];
  ethos: SettingsEthos | null;
  performance: SettingsPerformance | null;
}

/** Connect/reconnect copy is named for what it does, per §10.11.2. */
const CONNECT_X_LABEL = "Connect X";

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/v1/me", { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as Me;
}

/**
 * The overview payload behind the stat band, the PnL panel, and the activity
 * table. Composed client-side from four existing endpoints — no route, URL,
 * or contract changes (invariant 6). Performance degrades to null (auxiliary);
 * passes and executions failures are errors.
 */
async function fetchSettingsExtra(slug: string | null): Promise<SettingsExtra> {
  // Same-origin client calls (never a bare fetch): the unit suite mocks
  // `@/lib/client`, so a global fetch here would hit the real network layer
  // in jsdom and report unhandled rejections. clientGet failures on passes
  // or executions propagate to the error state; ethos degrades to null.
  const [passesBody, execBody, ethos] = await Promise.all([
    clientGet<{ passes?: SettingsPass[] } | null>("/api/v1/me/passes?limit=100"),
    clientGet<{ executions?: SettingsExecution[] } | null>("/api/v1/me/executions?limit=100"),
    clientGet<SettingsEthos>("/api/v1/integrations/ethos/me").catch(
      (): SettingsEthos | null => null,
    ),
  ]);
  let performance: SettingsPerformance | null = null;
  if (slug) {
    try {
      performance = await clientGet<SettingsPerformance>(
        `/api/v1/profiles/${encodeURIComponent(slug)}/performance`,
      );
    } catch {
      performance = null;
    }
  }
  return {
    passes: passesBody?.passes ?? [],
    executions: execBody?.executions ?? [],
    ethos,
    performance,
  };
}

export interface LinkedWallet {
  id: string;
  accountAddress: string;
}

async function defaultLinkAccount(accountAddress: string): Promise<LinkedWallet> {
  return clientPost<LinkedWallet>("/api/v1/me/trading-accounts", {
    accountAddress,
    provider: "hyperliquid",
  });
}

async function defaultUnlinkAccount(accountId: string): Promise<void> {
  await clientDelete<{ ok: boolean }>(`/api/v1/me/trading-accounts/${accountId}`);
}

/**
 * The execution wallet (D-023): connect, reconnect/swap, unlink.
 *
 * One wallet per user — the server replaces the old row when a new address
 * is linked. Only addresses cross the wire; the browser wallet itself is
 * connected through ConnectKit, and PASS-side unlink also drops the browser
 * connection so a later Take reconnects from a clean state (D-023: wallet
 * connects at Take time).
 */
function WalletSection({
  accounts,
  reload,
  linkAccount = defaultLinkAccount,
  unlinkAccount = defaultUnlinkAccount,
}: {
  accounts: Me["tradingAccounts"];
  reload: () => void;
  linkAccount?: (accountAddress: string) => Promise<LinkedWallet>;
  unlinkAccount?: (accountId: string) => Promise<void>;
}) {
  const row = accounts.find((a) => a.isPrimary) ?? accounts[0] ?? null;
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<string | null>(null);
  const linking = useRef(false);

  const fail = (e: unknown, fallback: string) => {
    setError(e instanceof Error ? e.message : fallback);
  };

  // Auto-link: the browser wallet is connected but no PASS row exists yet.
  // Linking the same address twice is idempotent server-side, so a
  // double-fired effect cannot create a second row.
  useEffect(() => {
    if (row || !isConnected || !address || linking.current) return;
    linking.current = true;
    setBusy(true);
    setError(null);
    linkAccount(address)
      .then(() => {
        notifyMeChanged();
        reload();
      })
      .catch((e) => fail(e, "Could not link the wallet."))
      .finally(() => {
        setBusy(false);
        linking.current = false;
      });
  }, [row, isConnected, address, linkAccount, reload]);

  // Replace detection: the connected browser wallet is not the linked one.
  // The prompt is inline (confirm/cancel buttons), never a native dialog.
  useEffect(() => {
    if (!row || !isConnected || !address) return;
    if (address.toLowerCase() !== row.accountAddress.toLowerCase()) {
      setPendingReplace((prev) => prev ?? address);
    } else {
      setPendingReplace(null);
    }
  }, [row, isConnected, address]);

  const confirmReplace = async () => {
    if (!row || !pendingReplace) return;
    setBusy(true);
    setError(null);
    try {
      await unlinkAccount(row.id);
      await linkAccount(pendingReplace);
      setPendingReplace(null);
      notifyMeChanged();
      reload();
    } catch (e) {
      fail(e, "Could not replace the wallet.");
    } finally {
      setBusy(false);
    }
  };

  const cancelReplace = () => {
    // Back to a clean state: forget the candidate and drop the browser
    // connection to the wallet that was never linked.
    setPendingReplace(null);
    disconnect();
  };

  const confirmUnlinkWallet = async () => {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await unlinkAccount(row.id);
      setConfirmUnlink(false);
      disconnect();
      notifyMeChanged();
      reload();
    } catch (e) {
      fail(e, "Could not unlink the wallet.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!row) return;
    try {
      await navigator.clipboard.writeText(row.accountAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — the full address is shown above.");
    }
  };

  return (
    <Panel>
      <h2 style={{ fontSize: "var(--type-title-s-size)" }}>Wallet</h2>
      <p className="pass-stale">
        The wallet your account executes with. This is not identity — it never
        appears on your public profile.
      </p>

      {!row ? (
        <Stack gap="3">
          <p className="pass-stale">No wallet linked.</p>
          {busy ? (
            <p className="pass-stale" role="status">
              Linking the wallet…
            </p>
          ) : (
            <Inline gap="3">
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="primary"
                    onClick={show}
                  >
                    Connect wallet
                  </button>
                )}
              </ConnectKitButton.Custom>
            </Inline>
          )}
        </Stack>
      ) : (
        <Stack gap="3">
          <Inline gap="3" align="center">
            <span
              className="pass-wallet-address"
              title={row.accountAddress}
              aria-label={`Linked wallet ${row.accountAddress}`}
            >
              {truncateAddress(row.accountAddress)}
            </span>
            <button
              type="button"
              className="pass-btn"
              data-variant="secondary"
              disabled={busy}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </Inline>
          <Inline gap="3">
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="secondary"
                  disabled={busy}
                  onClick={show}
                >
                  Reconnect
                </button>
              )}
            </ConnectKitButton.Custom>
            <button
              type="button"
              className="pass-btn"
              data-variant="secondary"
              disabled={busy}
              onClick={() => setConfirmUnlink(true)}
            >
              Unlink
            </button>
          </Inline>

          {pendingReplace ? (
            <Stack gap="3">
              <p className="pass-thesis">
                Replace the currently linked wallet? {truncateAddress(row.accountAddress)}{" "}
                becomes {truncateAddress(pendingReplace)}.
              </p>
              <Inline gap="3">
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="primary"
                  disabled={busy}
                  onClick={confirmReplace}
                >
                  Replace wallet
                </button>
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="secondary"
                  disabled={busy}
                  onClick={cancelReplace}
                >
                  Cancel
                </button>
              </Inline>
            </Stack>
          ) : null}

          {confirmUnlink ? (
            <Stack gap="3">
              <p className="pass-thesis">
                Unlink this wallet? Taking a Pass will require connecting a wallet
                again.
              </p>
              <Inline gap="3">
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="primary"
                  disabled={busy}
                  onClick={confirmUnlinkWallet}
                >
                  Unlink wallet
                </button>
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmUnlink(false)}
                >
                  Cancel
                </button>
              </Inline>
            </Stack>
          ) : null}
        </Stack>
      )}

      {error ? <ValidationMessage>{error}</ValidationMessage> : null}
    </Panel>
  );
}

function numOrNull(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Sum of realized PnL over the given rows. Null when no row carries one. */
function sumRealized(executions: readonly SettingsExecution[]): number | null {
  let total = 0;
  let any = false;
  for (const e of executions) {
    const n = numOrNull(e.realizedPnl);
    if (n !== null) {
      total += n;
      any = true;
    }
  }
  return any ? total : null;
}

/** Cumulative realized-PnL series, oldest first, for the sparkline. */
function cumulativePnl(executions: readonly SettingsExecution[]): number[] {
  const sorted = [...executions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  let acc = 0;
  const pts: number[] = [];
  for (const e of sorted) {
    const n = numOrNull(e.realizedPnl);
    if (n !== null) {
      acc += n;
      pts.push(acc);
    }
  }
  return pts;
}

const ACTIVITY_COLUMNS: DataTableColumn<SettingsExecution>[] = [
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
    key: "status",
    label: "STATUS",
    render: (e) => <DataCell>{statusLabel(e.status)}</DataCell>,
  },
  {
    key: "pnl",
    label: "PNL",
    numeric: true,
    render: (e) => <PnlCell value={e.realizedPnl} />,
  },
  {
    key: "when",
    label: "WHEN",
    render: (e) => <Timestamp value={e.createdAt} relative={formatRelative(e.createdAt)} />,
  },
];

function PnlPanel({ executions }: { executions: SettingsExecution[] }) {
  const [period, setPeriod] = useState<PeriodId>("7d");
  const window = periodWindow(period);
  const rows = executions.filter((e) => inWindow(e.createdAt, window));
  const total = sumRealized(rows);
  const pts = cumulativePnl(rows);
  const tone = pts.length >= 2 && pts[pts.length - 1] >= pts[0] ? "positive" : "negative";

  return (
    <DataCard
      id="Realized PnL"
      sub="Closed executions"
      value={total === null ? "—" : <Pnl value={total} />}
    >
      <Stack gap="4">
        <SegmentedControl
          label="PnL period"
          options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
          value={period}
          onChange={setPeriod}
        />
        {pts.length >= 2 ? (
          <Sparkline points={pts} tone={tone} label="Cumulative realized PnL, oldest to newest" />
        ) : (
          <p className="pass-stale">Not enough history for a series in this period.</p>
        )}
        <p className="pass-stale">
          Sum of realized PnL for executions closed in this period. No percent
          change is shown: there is no basis endpoint to compute one from.
        </p>
      </Stack>
    </DataCard>
  );
}

function SettingsReady({
  me,
  loadExtra = fetchSettingsExtra,
  onSave,
  onNavigate,
  linkAccount,
  unlinkAccount,
  reload,
}: {
  me: Me;
  loadExtra?: (slug: string | null) => Promise<SettingsExtra>;
  onSave?: (patch: { displayName: string; bio: string }) => Promise<void>;
  /** Injectable navigation for the Connect X CTA (jsdom has no navigation). */
  onNavigate?: (url: string) => void;
  /** Injectable wallet link/unlink for tests (default: the real API calls). */
  linkAccount?: (accountAddress: string) => Promise<LinkedWallet>;
  unlinkAccount?: (accountId: string) => Promise<void>;
  reload: () => void;
}) {
  type ExtraState =
    | { status: "loading" }
    | { status: "ready"; extra: SettingsExtra }
    | { status: "error"; error: string };
  const [extraState, setExtraState] = useState<ExtraState>({ status: "loading" });
  const [extraAttempt, setExtraAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setExtraState({ status: "loading" });
    loadExtra(me.profileSlug)
      .then((extra) => {
        if (live) setExtraState({ status: "ready", extra });
      })
      .catch((e) => {
        if (live)
          setExtraState({
            status: "error",
            error: e instanceof Error ? e.message : "Request failed",
          });
      });
    return () => {
      live = false;
    };
  }, [extraAttempt, me.profileSlug, loadExtra]);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Tour replay (D-022): resetting completion re-opens the one-time tour.
  const [tourState, setTourState] = useState<"idle" | "working" | "done" | "error">("idle");

  const startEdit = () => {
    setDisplayName(me.displayName ?? "");
    setBio(me.bio ?? "");
    setEditing(true);
  };

  const save = async () => {
    // Production default: persist through PATCH /profiles/me. Tests inject
    // onSave instead so no network runs in the runner.
    const persist =
      onSave ??
      (async (patch: { displayName: string; bio: string }) => {
        await clientPatch("/api/v1/profiles/me", patch);
      });
    setSaveState("saving");
    try {
      await persist({ displayName, bio });
      setSaveState("saved");
      setEditing(false);
      reload();
    } catch {
      // Stay in edit mode with the user's text intact; the error clears
      // itself after a few seconds so a stale failure cannot linger.
      setSaveState("error");
      window.setTimeout(() => {
        setSaveState((s) => (s === "error" ? "idle" : s));
      }, 4000);
    }
  };

  // Single-state rule, D-023: identity is X-only. The X section
  // renders while connected, otherwise its connect CTA renders.
  // The execution wallet is managed in the Wallet section below (not identity,
  // never on the public profile or topbar).
  const xEntry = connectionByName(me.connections, "x");
  const xLive = xEntry?.connected === true;
  const ethosEntry = connectionByName(me.connections, "ethos");
  const ethosOn = isEthosVisible(me);
  const goX = () => {
    if (onNavigate) onNavigate("/api/v1/auth/x/start");
    else if (typeof window !== "undefined") {
      window.location.assign("/api/v1/auth/x/start");
    }
  };

  const extra = extraState.status === "ready" ? extraState.extra : null;
  const score = extra?.ethos?.credibilityScore ?? null;
  const activity = extra
    ? [...extra.executions]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    : [];
  const perf = extra?.performance ?? null;

  // Sign-out lives in the topbar X menu (D-024). Profile states identity;
  // it is never the sign-out surface.

  return (
    <Stack gap="6">
      {/* Hero: eyebrow, headline, identity header (avatar + name + handle +
          slug + Ethos score), connection chips. No wallet state here (D-023):
          the address never enters this header. */}
      <Surface strength="section">
        <Stack gap="5">
          <NumberedEyebrow label="Settings" />
          {/* `section`: the Discover hero size, not the landing hero size.
              These are data-surface heroes and read over-scaled at the full
              hero step (§14.4 section step). */}
          <DisplayHeadline
            section
            lines={[
              [{ text: "Settings." }],
              [{ text: "Your" }, { text: "account.", accent: true }],
            ]}
          />
          <div className="pass-profile-head" data-testid="settings-identity">
            <Avatar handle={me.handle ?? me.displayName} size="lg" />
            <div className="pass-profile-identity" style={{ display: "grid", gap: "var(--space-1)", flex: "1 1 auto" }}>
              <strong style={{ fontSize: "var(--type-title-m-size)" }}>
                {me.displayName ?? "Unnamed"}
              </strong>
              {me.handle ? (
                <span className="pass-value">@{me.handle}</span>
              ) : null}
              {me.profileSlug ? (
                <span className="pass-stale">{`pass.to/${me.profileSlug}`}</span>
              ) : (
                <span className="pass-stale">No public profile yet.</span>
              )}
              <span className="pass-value" aria-label="Ethos score">
                {extraState.status === "loading"
                  ? "Ethos score …"
                  : score === null
                    ? "Ethos score — not resolved"
                    : `Ethos score ${score.toLocaleString("en-US")}`}
              </span>
            </div>
          </div>
          {/* Connection state lives in the header area: the chip IS the state,
              and it is rendered exactly once. The Connections tab below
              jumps here. Sign-out lives in the topbar X menu (D-024). */}
          <div id="settings-connections" className="pass-anchor">
            {!xLive ? (
              <Stack gap="3">
                <h2 style={{ fontSize: "var(--type-title-s-size)" }}>
                  Connect X to activate your profile
                </h2>
                <p className="pass-stale">
                  Link an X identity to switch on your profile surfaces.
                </p>
                <Inline gap="3">
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="primary"
                    onClick={goX}
                  >
                    {CONNECT_X_LABEL}
                  </button>
                </Inline>
              </Stack>
            ) : (
              <Stack gap="3">
                {xEntry ? (
                  <ConnectionChip provider="X" tone="connected" label={xEntry.label} />
                ) : null}
                {ethosOn && ethosEntry ? (
                  <ConnectionChip
                    provider="Ethos"
                    tone="displayOnly"
                    label={ethosEntry.label}
                  />
                ) : null}
              </Stack>
            )}
          </div>
        </Stack>
      </Surface>

      {/* Stat band: the three most relevant user counters, real values only. */}
      {extraState.status === "loading" ? (
        <LoadingBlock label="Loading your overview" rows={3} />
      ) : extraState.status === "error" ? (
        <ErrorBlock
          detail={extraState.error}
          onRetry={() => setExtraAttempt((n) => n + 1)}
        />
      ) : extra ? (
        <Stack gap="6">
          <MetricCardRow>
            <div data-testid="settings-stat-band" style={{ display: "contents" }}>
              <MetricCard label="Passes created" value={String(extra.passes.length)} />
              <MetricCard label="Executions" value={String(extra.executions.length)} />
              <MetricCard
                label="Ethos score"
                value={score === null ? "—" : score.toLocaleString("en-US")}
                sub={score === null ? "Not resolved" : "Community sentiment"}
              />
            </div>
          </MetricCardRow>

          {/* PnL panel beside the slogan rail. */}
          <div className="pass-settings-grid">
            <div data-testid="settings-pnl">
              <PnlPanel executions={extra.executions} />
            </div>
            <DataCard
              id="PASS"
              sub="Social execution for Hyperliquid"
              prose
              value="See a trade. Know the trader. Take the trade."
            />
          </div>

          {/* Two metric sub-cards: server-computed. */}
          {perf ? (
            <MetricCardRow>
              <MetricCard
                label="Success"
                value={perf.passSuccessMetric === null ? "—" : `${perf.passSuccessMetric}%`}
                sub={`TP / completed · ${perf.successMetricWindow}`}
              />
              <MetricCard
                label="Average R"
                value={perf.averageRMultiple === null ? "—" : `${perf.averageRMultiple}R`}
                sub="Closed executions"
              />
            </MetricCardRow>
          ) : null}

          {/* Recent activity: latest executions. Thumbnails dropped — PASS
              executions carry no image. */}
          <Panel>
            <Inline gap="3" align="center">
              <h2 style={{ fontSize: "var(--type-title-s-size)" }}>Recent activity</h2>
              <span style={{ flex: "1 1 auto" }} />
              <Link href="/me/executions" className="pass-link-btn">
                View All →
              </Link>
            </Inline>
            <div data-testid="settings-activity">
              {activity.length === 0 ? (
                <EmptyBlock title="No activity yet">
                  Take a Pass and the execution appears here.
                </EmptyBlock>
              ) : (
                <DataTable
                  caption="Your recent executions"
                  columns={ACTIVITY_COLUMNS}
                  rows={activity}
                  rowKey={(e) => e.id}
                />
              )}
            </div>
          </Panel>
        </Stack>
      ) : null}

      {/* Section tab bar: anchor navigation within Settings. */}
      <ChipBar label="Settings sections">
        <ChipButton href="#settings-identity-section">Identity</ChipButton>
        <ChipButton href="#settings-connections">Connections</ChipButton>
        <ChipButton href="#settings-wallet">Wallet</ChipButton>
        <ChipButton href="#settings-tour">Tour</ChipButton>
      </ChipBar>

      <div id="settings-identity-section" className="pass-anchor">
        <Section label="Identity">
          {/* §10.10.2 public profile fields. Display name and bio only —
           * no key material appears here or anywhere in this screen. */}
          <Panel>
            <h2 style={{ fontSize: "var(--type-title-s-size)" }}>Identity</h2>
            {editing ? (
              <Stack gap="4">
                <Field label="Display name">
                  {({ controlId }) => (
                    <TextInput
                      id={controlId}
                      value={displayName}
                      onChange={setDisplayName}
                    />
                  )}
                </Field>
                <Field label="Bio">
                  {({ controlId }) => (
                    <Textarea
                      id={controlId}
                      value={bio}
                      onChange={setBio}
                      autoFocus
                    />
                  )}
                </Field>
                <Inline gap="3">
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="primary"
                    disabled={saveState === "saving"}
                    onClick={save}
                  >
                    {saveState === "saving" ? "Saving" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="secondary"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                  {saveState === "error" ? (
                    <span className="pass-validation" role="alert">
                      Could not save the profile.
                    </span>
                  ) : null}
                </Inline>
              </Stack>
            ) : (
              <Inline gap="4">
                {/* Bio is read-only text until clicked: the text itself is
                    the edit target (no always-on Save), now in the shared
                    bordered secondary box so it reads as a button. Clicking
                    opens the form below with the cursor in the bio field. */}
                <button
                  type="button"
                  className="pass-bio-edit pass-btn"
                  data-variant="secondary"
                  aria-label="Edit bio"
                  onClick={startEdit}
                >
                  {me.bio ? (
                    <span className="pass-stale">{me.bio}</span>
                  ) : (
                    <span className="pass-stale">No bio yet.</span>
                  )}
                </button>
              </Inline>
            )}
          </Panel>
        </Section>
      </div>

      {/* Execution wallet (D-023): managed here, never identity. */}
      <div id="settings-wallet" className="pass-anchor">
        <Section label="Wallet">
          <WalletSection
            accounts={me.tradingAccounts}
            reload={reload}
            linkAccount={linkAccount}
            unlinkAccount={unlinkAccount}
          />
        </Section>
      </div>

      {/* D-022: the one-time tour can be re-opened from here. */}
      <div id="settings-tour" className="pass-anchor">
        <Section label="Tour">
          <Panel>
            <Inline gap="3" align="center">
              <button
                type="button"
                className="pass-btn"
                data-variant="secondary"
                disabled={tourState === "working"}
                onClick={() => {
                  setTourState("working");
                  import("@/lib/client")
                    .then(({ clientPatch }) =>
                      clientPatch("/api/v1/profiles/me", { tourCompletedAt: null }),
                    )
                    .then(() => {
                      setTourState("done");
                      reload();
                    })
                    .catch(() => setTourState("error"));
                }}
              >
                {tourState === "working" ? "Opening" : "Replay the tour"}
              </button>
              {tourState === "done" ? (
                <span className="pass-stale">The tour will show again.</span>
              ) : null}
              {tourState === "error" ? (
                <span className="pass-validation" role="alert">
                  Could not re-open the tour.
                </span>
              ) : null}
            </Inline>
          </Panel>
        </Section>
      </div>
    </Stack>
  );
}

export function SettingsClient({
  probe,
  load = fetchMe,
  loadExtra = fetchSettingsExtra,
  onSave,
  onNavigate,
  linkAccount,
  unlinkAccount,
}: {
  probe?: () => Promise<boolean>;
  load?: () => Promise<Me>;
  loadExtra?: (slug: string | null) => Promise<SettingsExtra>;
  onSave?: (patch: { displayName: string; bio: string }) => Promise<void>;
  /** Injectable navigation for the Connect X CTA (jsdom has no navigation). */
  onNavigate?: (url: string) => void;
  /** Injectable wallet link/unlink for tests (default: the real API calls). */
  linkAccount?: (accountAddress: string) => Promise<LinkedWallet>;
  unlinkAccount?: (accountId: string) => Promise<void>;
}) {
  const { state, reload } = useAuthenticatedResource<Me>({ probe, load });
  // Re-read /me when another surface mutates connection state (topbar
  // disconnect left this screen stale until a manual refresh — Bug 2a).
  useEffect(() => onMeChanged(reload), [reload]);

  return (
    <PageShell className="pass-settings">
      <ShellContent>

      <AuthenticatedView
        state={state}
        loadingLabel="Loading your profile"
        unauthorizedReason="Your profile belongs to a connected X identity."
        unauthorizedAction={<SignInXButton onNavigate={onNavigate} />}
        empty={<EmptyBlock title="No profile yet">Connect an identity to begin.</EmptyBlock>}
        onRetry={reload}
      >
        {(me) => (
          <SettingsReady
            me={me}
            loadExtra={loadExtra}
            onSave={onSave}
            onNavigate={onNavigate}
            linkAccount={linkAccount}
            unlinkAccount={unlinkAccount}
            reload={reload}
          />
        )}
      </AuthenticatedView>
      </ShellContent>
    </PageShell>
  );
}
