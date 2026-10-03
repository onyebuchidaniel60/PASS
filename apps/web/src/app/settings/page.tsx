"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ErrorBlock, Field, LoadingBlock, Panel, Rule, inputClass } from "@pass/ui";
import { clientGet, clientPatch, clientPost } from "@/lib/client";
import { truncateAddress } from "@/lib/format";

/**
 * useSearchParams requires a Suspense boundary so the route can be
 * statically prerendered (Next.js requirement).
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading profile" />}>
      <SettingsInner />
    </Suspense>
  );
}

interface Me {
  userId: string;
  profileSlug: string | null;
  displayName: string | null;
  connections: { provider: string; connected: boolean; label: string; displayOnly: boolean }[];
  tradingAccounts: {
    id: string;
    accountAddress: string;
    agentAddress: string | null;
    isPrimary: boolean;
  }[];
  demoMode: boolean;
}

function SettingsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const xStatus = search.get("x");

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [handle, setHandle] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    clientGet<Me>("/api/v1/me")
      .then((d) => {
        setMe(d);
        setDisplayName(d.displayName ?? "");
      })
      .catch(() => setError("Sign in to manage your profile."))
      .finally(() => setLoading(false));
  }, []);

  async function startSession() {
    setBusy(true);
    setError(null);
    try {
      await clientPost("/api/v1/auth/session", { displayName: "PASS Trader" });
      router.refresh();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a session.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!me?.profileSlug) {
        await clientPost("/api/v1/profiles", { slug, displayName, bio, handle });
        setNotice("Profile created.");
      } else {
        await clientPatch("/api/v1/profiles/me", { displayName, bio, handle });
        setNotice("Profile updated.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the profile.");
    } finally {
      setBusy(false);
    }
  }

  async function linkX() {
    setBusy(true);
    setError(null);
    try {
      await clientPost("/api/v1/auth/x/link-mock", { handle });
      setNotice(`Linked @${handle}.`);
      router.refresh();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link X.");
    } finally {
      setBusy(false);
    }
  }

  async function linkAccount() {
    setBusy(true);
    setError(null);
    try {
      await clientPost("/api/v1/me/trading-accounts", { accountAddress: address });
      setNotice("Hyperliquid account linked.");
      setAddress("");
      router.refresh();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link the account.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshEthos() {
    setBusy(true);
    setError(null);
    try {
      await clientPost("/api/v1/integrations/ethos/refresh");
      setNotice("Ethos reputation refreshed.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh Ethos.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading profile" />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile and connections</h1>

      {xStatus === "connected" && (
        <p className="rounded border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
          X connected.
        </p>
      )}
      {error && <ErrorBlock title="Something failed" body={error} />}
      {notice && (
        <p className="rounded border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {!me && (
        <Panel title="Get started">
          <p className="text-sm text-neutral-700">
            Create a PASS session to author Passes and take other Traders&apos; Passes.
          </p>
          <div className="mt-4">
            <Button variant="primary" disabled={busy} onClick={startSession}>
              Create session
            </Button>
          </div>
        </Panel>
      )}

      {me && !me.profileSlug && (
        <Panel title="Create your PASS profile">
          <div className="flex flex-col gap-4">
            <Field label="Handle (URL slug)" htmlFor="slug" helper="3-32 lowercase letters, numbers or underscores.">
              <input id="slug" className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
            </Field>
            <Field label="Display name" htmlFor="displayName">
              <input id="displayName" className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Bio" htmlFor="bio">
              <textarea id="bio" rows={3} className={inputClass} value={bio} onChange={(e) => setBio(e.target.value)} />
            </Field>
            <Button variant="primary" disabled={busy || !slug || !displayName} onClick={saveProfile}>
              Create profile
            </Button>
          </div>
        </Panel>
      )}

      {me?.profileSlug && (
        <>
          <Panel title="Public profile">
            <div className="flex flex-col gap-4">
              <Field label="Display name" htmlFor="dn">
                <input id="dn" className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
              <Field label="Bio" htmlFor="b">
                <textarea id="b" rows={3} className={inputClass} value={bio} onChange={(e) => setBio(e.target.value)} />
              </Field>
              <Button disabled={busy} onClick={saveProfile}>
                Save
              </Button>
            </div>
          </Panel>

          <Panel title="Connections">
            <ul className="flex flex-col gap-2 text-sm">
              {me.connections.map((c) => (
                <li key={c.provider} className="font-mono text-neutral-700">
                  {c.label}
                </li>
              ))}
            </ul>
            <Rule />
            <div className="mt-4 flex flex-col gap-3">
              <Field
                label="X handle"
                htmlFor="xhandle"
                helper={
                  me.demoMode
                    ? "Mock mode links a display-only X identity and stores no OAuth token."
                    : "Uses the real X OAuth flow."
                }
              >
                <input id="xhandle" className={inputClass} value={handle} onChange={(e) => setHandle(e.target.value)} />
              </Field>
              <Button disabled={busy || !handle} onClick={linkX}>
                Link X
              </Button>
            </div>
          </Panel>

          <Panel title="Hyperliquid">
            <ul className="flex flex-col gap-1 font-mono text-sm text-neutral-700">
              {me.tradingAccounts.length === 0 && <li className="text-neutral-500">No account linked.</li>}
              {me.tradingAccounts.map((a) => (
                <li key={a.id}>
                  {truncateAddress(a.accountAddress)}
                  {a.isPrimary ? " (primary)" : ""}
                </li>
              ))}
            </ul>
            <Rule />
            <div className="mt-4 flex flex-col gap-3">
              <Field
                label="Hyperliquid account address"
                htmlFor="addr"
                helper="Only the address is sent. Your private key never reaches PASS."
              >
                <input id="addr" className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" />
              </Field>
              <Button disabled={busy || !address} onClick={linkAccount}>
                Link account
              </Button>
            </div>
          </Panel>

          <Panel title="Ethos reputation">
            <p className="text-sm text-neutral-600">
              Ethos is shown as external reputation context. PASS never merges it
              with trading performance.
            </p>
            <div className="mt-3">
              <Button disabled={busy} onClick={refreshEthos}>
                Refresh Ethos
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}