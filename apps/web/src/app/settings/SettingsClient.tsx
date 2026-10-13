"use client";

/**
 * Profile and connections (§10.10) — the Trader's own settings.
 *
 * Same pattern: `useAuthenticatedResource` + `AuthenticatedView`.
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
 * (/u/{slug}) or the topbar — but the user must be able to see and swap the
 * wallet their account executes with, so Settings owns connect / reconnect /
 * unlink. Only the address ever crosses the wire (D-018.9).
 */

import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectKitButton } from "connectkit";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { notifyMeChanged, onMeChanged } from "@/lib/me-events";
import {
  connectionByName,
  isEthosVisible,
} from "@/lib/me";
import { clientDelete, clientPatch, clientPost } from "@/lib/client";
import { truncateAddress } from "@/lib/format";
import { SignInXButton } from "@/components/SignInX";
import { Field, Textarea, TextInput, ValidationMessage } from "@/components/wave2/controls";
import { Avatar, ConnectionChip } from "@/components/wave3/identity";
import { EmptyBlock } from "@/components/wave3/data";
import { Inline, PageShell, Panel, ShellContent, Stack } from "@/components/wave1/layout";
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

/** Connect/reconnect copy is named for what it does, per §10.11.2. */
const CONNECT_X_LABEL = "Connect X";

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/v1/me", { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as Me;
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
              data-variant="ghost"
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
                  data-variant="ghost"
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
              data-variant="ghost"
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
                  data-variant="ghost"
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
                  data-variant="ghost"
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

export function SettingsClient({
  probe,
  load = fetchMe,
  onSave,
  onNavigate,
  linkAccount,
  unlinkAccount,
}: {
  probe?: () => Promise<boolean>;
  load?: () => Promise<Me>;
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
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Tour replay (D-022): resetting completion re-opens the one-time tour.
  const [tourState, setTourState] = useState<"idle" | "working" | "done" | "error">("idle");
  // X disconnect (D-024): the topbar no longer carries a chip, so Settings
  // owns the only sign-out path in the UI.
  const [xBusy, setXBusy] = useState(false);
  const [xError, setXError] = useState<string | null>(null);

  const startEdit = (me: Me) => {
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

  const disconnectX = async () => {
    setXBusy(true);
    setXError(null);
    try {
      await clientPost("/api/v1/auth/x/disconnect");
      // D-024: the session is over, so its key material ends with it.
      const { clearSessionKeys } = await import("@/lib/agent-keystore");
      clearSessionKeys();
    } catch {
      setXError("Could not disconnect X.");
      setXBusy(false);
      return;
    }
    const { notifyMeChanged } = await import("@/lib/me-events");
    notifyMeChanged();
    setXBusy(false);
    // Re-read: a dead session renders the connect CTA (D-024), no redirect.
    reload();
  };

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
        {(me) => {
          // Single-state rule, D-023: identity is X-only. The X section
          // renders while connected, otherwise its connect CTA renders.
          // The execution wallet is managed here in Settings (not identity,
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
          return (
          <Stack gap="6">
            {/* §10.10.2 public profile fields. Display name and bio only —
             * no key material appears here or anywhere in this screen. */}
            <Panel>
              <Inline gap="4" align="center">
                <Avatar handle={me.handle ?? me.displayName} size="lg" />
                <div style={{ display: "grid", gap: 4, flex: "1 1 auto" }}>
                  <strong style={{ fontSize: "var(--type-title-m-size)" }}>
                    {me.displayName ?? "Unnamed"}
                  </strong>
                  {me.profileSlug ? (
                    <span className="pass-stale">{`pass.to/${me.profileSlug}`}</span>
                  ) : (
                    <span className="pass-stale">No public profile yet.</span>
                  )}
                </div>
              </Inline>

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
                      data-variant="ghost"
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
                      the edit target (no always-on Save). Clicking opens the
                      form below with the cursor in the bio field. */}
                  <button
                    type="button"
                    className="pass-bio-edit"
                    aria-label="Edit bio"
                    onClick={() => startEdit(me)}
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

            {!xLive ? (
              /* No X identity: one CTA panel. Profile basics above stay —
               * they are PASS identity, not account attribution. */
              <Panel>
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
              </Panel>
            ) : (
              <>
                {/* One line per connected account. Disconnected renders its
                 CTA inline — the chip and the CTA never appear together.
                 Disconnect lives here: the topbar carries no X chip, so
                 this is the only sign-out path in the UI (D-024). */}
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
                  <Inline gap="3">
                    <button
                      type="button"
                      className="pass-btn"
                      data-variant="ghost"
                      disabled={xBusy}
                      onClick={() => void disconnectX()}
                    >
                      {xBusy ? "Disconnecting…" : "Disconnect X"}
                    </button>
                  </Inline>
                  {xError ? (
                    <span className="pass-validation" role="alert">
                      {xError}
                    </span>
                  ) : null}
                </Stack>
              </>
            )}

            {/* Execution wallet (D-023): managed here, never identity. */}
            <WalletSection
              accounts={me.tradingAccounts}
              reload={reload}
              linkAccount={linkAccount}
              unlinkAccount={unlinkAccount}
            />

            {/* D-022: the one-time tour can be re-opened from here. */}
            <Panel>
              <Inline gap="3" align="center">
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="ghost"
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
          </Stack>
          );
        }}
      </AuthenticatedView>
      </ShellContent>
    </PageShell>
  );
}