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
 * Connection state is FOUR-valued (§10.10.1): connected, read-only, disconnected
 * and errored are different situations with different actions, and the API
 * already reports `displayOnly` for the read-only case.
 *
 * PER-CONNECTION ERROR (§10.10, "error per connection"): a failure to connect one
 * provider must not blank the screen or lose the profile fields. Each connection
 * carries its own error and its own Retry.
 */

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { onMeChanged } from "@/lib/me-events";
import { XConnectedNotice } from "@/components/XConnectedNotice";
import { Field, Textarea, TextInput, Toggle } from "@/components/wave2/controls";
import { Avatar, ConnectionChip, type ConnectionTone } from "@/components/wave3/identity";
import { EmptyBlock } from "@/components/wave3/data";
import { Inline, PageShell, Panel, Section, Stack } from "@/components/wave1/layout";
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
const ACTION_LABEL: Record<string, string> = {
  X: "Connect X",
  hyperliquid: "Link Hyperliquid",
  ethos: "Resolve Ethos",
};

/**
 * Bug 2b: "account linked" (PASS server row) and "wallet session active"
 * (this browser's ConnectKit session) are TWO states and render as two
 * lines. Only the browser knows the second — the API cannot observe
 * ConnectKit — so this is derived client-side from wagmi, never merged
 * into the server's `connected` boolean.
 */
export function WalletSessionLine({ accountAddress }: { accountAddress: string }) {
  const { address, isConnected } = useAccount();
  const active =
    isConnected &&
    typeof address === "string" &&
    address.toLowerCase() === accountAddress.toLowerCase();
  return active ? (
    <span className="pass-stale">Wallet session active — this browser can sign.</span>
  ) : (
    <span className="pass-stale">
      Wallet session inactive — connect the holding wallet to sign.
    </span>
  );
}

function toneFor(c: Connection): ConnectionTone {
  if (c.connected && c.displayOnly) return "displayOnly";
  if (c.connected) return "connected";
  return "disconnected";
}

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/v1/me", { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as Me;
}

export function SettingsClient({
  probe,
  load = fetchMe,
  onSave,
  onConnect,
}: {
  probe?: () => Promise<boolean>;
  load?: () => Promise<Me>;
  onSave?: (patch: { displayName: string; bio: string }) => Promise<void>;
  onConnect?: (provider: string) => Promise<void>;
}) {
  const { state, reload } = useAuthenticatedResource<Me>({ probe, load });
  // Re-read /me when another surface mutates connection state (topbar
  // disconnect left this screen stale until a manual refresh — Bug 2a).
  useEffect(() => onMeChanged(reload), [reload]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [connError, setConnError] = useState<Record<string, string>>({});
  // Tour replay (D-022): resetting completion re-opens the one-time tour.
  const [tourState, setTourState] = useState<"idle" | "working" | "done" | "error">("idle");
  // §10.10.2 exposure toggle, opt-in: the Hyperliquid identity is hidden unless
  // the Trader turns it on.
  const [expose, setExpose] = useState(false);

  const startEdit = (me: Me) => {
    setDisplayName(me.displayName ?? "");
    setBio(me.bio ?? "");
    setEditing(true);
  };

  const connect = async (provider: string) => {
    if (!onConnect) return;
    setBusy(provider);
    // Cleared up front so a retry does not show a stale failure.
    setConnError((e) => ({ ...e, [provider]: "" }));
    try {
      await onConnect(provider);
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not connect.";
      setConnError((prev) => ({ ...prev, [provider]: msg }));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!onSave) return;
    setSaveState("saving");
    try {
      await onSave({ displayName, bio });
      setSaveState("saved");
      setEditing(false);
      reload();
    } catch (e) {
      setSaveState("error");
      void e;
    }
  };

  return (
    <PageShell>
      <Section label="Profile and connections">
        <h1>Profile</h1>
        <p className="pass-stale">Your public identity and the accounts it is bound to.</p>
      </Section>

      {/* The return leg of the X OAuth round trip. Sits above the profile
          fields because the confirmation is about the account, not the
          profile. */}
      <XConnectedNotice />

      <AuthenticatedView
        state={state}
        loadingLabel="Loading your profile"
        unauthorizedReason="Your profile belongs to a connected X identity."
        empty={<EmptyBlock title="No profile yet">Connect an identity to begin.</EmptyBlock>}
        onRetry={reload}
      >
        {(me) => (
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
                      <Textarea id={controlId} value={bio} onChange={setBio} />
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
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="primary"
                    onClick={() => startEdit(me)}
                  >
                    Save
                  </button>
                  {me.bio ? (
                    <span className="pass-stale">{me.bio}</span>
                  ) : (
                    <span className="pass-stale">No bio yet.</span>
                  )}
                </Inline>
              )}
            </Panel>

            {/* §10.10.1 connection states, one chip per provider, each with its
             * OWN action. A read-only connection has no action at all rather than
             * a disabled one. */}
            <Stack gap="3">
              {me.connections.length === 0 ? (
                <EmptyBlock title="No connections reported" />
              ) : (
                me.connections.map((c) => {
                  const tone = toneFor(c);
                  const err = connError[c.provider];
                  return (
                    <ConnectionChip
                      key={c.provider}
                      provider={c.provider}
                      label={c.label}
                      tone={err ? "error" : tone}
                      detail={err || (tone === "disconnected" ? "Not linked." : undefined)}
                      action={
                        tone === "displayOnly" ? undefined : {
                          label: ACTION_LABEL[c.provider] ?? `Connect ${c.provider}`,
                          busy: busy === c.provider,
                          onClick: () => connect(c.provider),
                        }
                      }
                    />
                  );
                })
              )}
            </Stack>

            {/* Trading accounts are addressed, never keyed. Linked (server)
             * and session-active (this browser) render as separate lines. */}
            <Panel>
              <h2 style={{ fontSize: "var(--type-title-s-size)" }}>Trading accounts</h2>
              {me.tradingAccounts.length === 0 ? (
                <p className="pass-stale">No Hyperliquid account linked yet.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                  {me.tradingAccounts.map((a) => (
                    <li key={a.id} style={{ display: "grid", gap: 2 }}>
                      <span className="pass-num" style={{ fontSize: "var(--type-data-s-size)" }}>
                        {`${a.accountAddress}${a.isPrimary ? "  · primary" : ""}`}
                      </span>
                      <WalletSessionLine accountAddress={a.accountAddress} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* §10.10.2 exposure toggle: the Hyperliquid identity is shown on the
             * public profile or it is not. It is opt-in. */}
            <Panel>
              <Toggle
                id="exposeHyperliquid"
                label="Show my Hyperliquid identity on my public profile"
                checked={expose}
                onChange={setExpose}
              />
            </Panel>

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
        )}
      </AuthenticatedView>
    </PageShell>
  );
}