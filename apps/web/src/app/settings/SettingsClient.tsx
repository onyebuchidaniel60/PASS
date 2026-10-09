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
 */

import { useEffect, useState } from "react";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { onMeChanged } from "@/lib/me-events";
import {
  connectionByName,
  isEthosVisible,
} from "@/lib/me";
import { XConnectedNotice } from "@/components/XConnectedNotice";
import { SignInXButton } from "@/components/SignInX";
import { Field, Textarea, TextInput } from "@/components/wave2/controls";
import { Avatar, ConnectionChip } from "@/components/wave3/identity";
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
const CONNECT_X_LABEL = "Connect X";

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/v1/me", { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as Me;
}

export function SettingsClient({
  probe,
  load = fetchMe,
  onSave,
  onNavigate,
}: {
  probe?: () => Promise<boolean>;
  load?: () => Promise<Me>;
  onSave?: (patch: { displayName: string; bio: string }) => Promise<void>;
  /** Injectable navigation for the Connect X CTA (jsdom has no navigation). */
  onNavigate?: (url: string) => void;
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

  const startEdit = (me: Me) => {
    setDisplayName(me.displayName ?? "");
    setBio(me.bio ?? "");
    setEditing(true);
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
        unauthorizedAction={<SignInXButton onNavigate={onNavigate} />}
        empty={<EmptyBlock title="No profile yet">Connect an identity to begin.</EmptyBlock>}
        onRetry={reload}
      >
        {(me) => {
          // Single-state rule, D-023: identity is X-only. The X section
          // renders while connected, otherwise its connect CTA renders.
          // No wallet sections exist anywhere on this screen.
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
                 * CTA inline — the chip and the CTA never appear together. */}
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
              </>
            )}

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
    </PageShell>
  );
}