"use client";

/**
 * OnboardingFlow — the real four-step onboarding (PRD §8.1) wired to `/me`.
 *
 * `OnboardingClient` is the presentational step shell (one step per screen,
 * per-step error, skip where allowed). This container owns the data: it
 * reads the flat `/me` payload as the source of truth for what is already
 * done, so a returning user never repeats a completed step, and it provides
 * the real step actions:
 *
 *   x            -> full navigation to the OAuth entry (same-origin proxy)
 *   profile      -> POST /api/v1/profiles (slug uniqueness enforced by API)
 *   hyperliquid  -> ConnectKit wallet connect, then link account_address
 *                   ONLY. No agent key is generated here and approveAgent is
 *                   never called — agent approval is a first-execution
 *                   concern (D-019.1, Stage F), never an onboarding one.
 *   ethos        -> POST /integrations/ethos/refresh. Never blocks: success
 *                   shows the score with the API's disclaimer (D-007), any
 *                   failure shows the "later" state and still continues.
 *
 * Completion is the profile row itself — no extra column, no new table.
 * When every required step is done the flow renders the handoff
 * ("You're set. Go find a Pass.") with explicit links. No auto-redirect:
 * the user chooses where to go.
 */

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { XConnectedNotice } from "@/components/XConnectedNotice";
import { WalletControl } from "@/components/WalletControl";
import { Field, Textarea, TextInput } from "@/components/wave2/controls";
import { Inline, PageShell, Panel, Section, Stack } from "@/components/wave1/layout";
import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";
import { clientGet, clientPost } from "@/lib/client";
import { truncateAddress } from "@/lib/format";
import {
  ethosConnection,
  hasTradingAccount,
  isXConnected,
  type MePayload,
} from "@/lib/me";
import { OnboardingClient, type StepId, type StepProgress } from "./OnboardingClient";

interface EthosRefresh {
  providerProfileId: string | null;
  credibilityScore: number | null;
  reviewsCount: number | null;
  vouchesCount: number | null;
  disclaimer: string;
}

/**
 * Mirrors `Slug` in `@pass/contracts` (3–32, lowercase alnum + underscore).
 * UX-only: the API validates authoritatively and rejects anything else.
 */
function slugError(value: string): string | null {
  if (value.length < 3 || value.length > 32) return "Slug must be 3–32 characters.";
  if (!/^[a-z0-9_]+$/.test(value)) {
    return "Slug must be lowercase letters, numbers, or underscores.";
  }
  return null;
}

const HANDOFF = 4;

export function OnboardingFlow({
  onNavigate,
}: {
  /** Injectable navigation for the X step (jsdom has no real navigation). */
  onNavigate?: (url: string) => void;
}) {
  const { state, reload } = useAuthenticatedResource<MePayload>({
    load: () => clientGet<MePayload>("/api/v1/me"),
  });

  return (
    <AuthenticatedView
      state={state}
      loadingLabel="Loading your onboarding progress"
      unauthorizedReason="Sign in with X to begin onboarding."
      onRetry={reload}
    >
      {(me) => <FlowInner me={me} reload={reload} onNavigate={onNavigate} />}
    </AuthenticatedView>
  );
}

function FlowInner({
  me,
  reload,
  onNavigate,
}: {
  me: MePayload;
  reload: () => void;
  onNavigate?: (url: string) => void;
}) {
  const { address } = useAccount();
  const [manual, setManual] = useState<number | null>(null);
  const [skipped, setSkipped] = useState<Set<StepId>>(new Set());
  const [ethosAcked, setEthosAcked] = useState(false);
  const [ethosResult, setEthosResult] = useState<EthosRefresh | null>(null);
  const [ethosFailed, setEthosFailed] = useState(false);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const progress: StepProgress[] = [
    { step: "x", complete: isXConnected(me) },
    { step: "profile", complete: Boolean(me.profileSlug) },
    { step: "hyperliquid", complete: hasTradingAccount(me) },
    {
      step: "ethos",
      complete: Boolean(ethosConnection(me)?.connected) || ethosAcked,
    },
  ];
  const done = (id: StepId) => progress.find((p) => p.step === id)?.complete ?? false;

  // First incomplete step wins; Ethos yields to skip/acknowledgement.
  // `manual` is set only by Back / result-hold, and any successful action
  // clears it back to auto-advance.
  const auto =
    !done("x")
      ? 0
      : !done("profile")
        ? 1
        : !done("hyperliquid") && !skipped.has("hyperliquid")
          ? 2
          : !done("ethos") && !skipped.has("ethos")
            ? 3
            : HANDOFF;
  const display = manual ?? auto;

  const go = (url: string) => {
    if (onNavigate) onNavigate(url);
    else if (typeof window !== "undefined") window.location.assign(url);
  };

  const onAction = async (id: StepId) => {
    if (id === "x") {
      go("/api/v1/auth/x/start");
      return;
    }
    if (id === "profile") {
      const bad = slugError(slug.trim());
      if (bad) throw new Error(bad);
      if (!displayName.trim()) throw new Error("Display name is required.");
      await clientPost("/api/v1/profiles", {
        slug: slug.trim(),
        displayName: displayName.trim(),
        ...(bio.trim() ? { bio: bio.trim() } : {}),
      });
      setManual(null);
      reload();
      return;
    }
    if (id === "hyperliquid") {
      if (!address) throw new Error("Connect your wallet first, then link the account.");
      await clientPost("/api/v1/me/trading-accounts", { accountAddress: address });
      setManual(null);
      reload();
      return;
    }
    // Ethos stays on screen after resolving so the score (or the "later"
    // state) is actually seen; Continue advances explicitly. A refresh
    // failure is absorbed here rather than thrown: Ethos must never block
    // onboarding, and the action button stays available for a retry.
    try {
      const res = await clientPost<EthosRefresh>("/api/v1/integrations/ethos/refresh");
      setEthosResult(res);
      setEthosFailed(res.providerProfileId === null && res.credibilityScore === null);
    } catch {
      setEthosResult(null);
      setEthosFailed(true);
    }
    setEthosAcked(true);
    setManual(3);
  };

  const onSkip = (id: StepId) => {
    setSkipped((s) => new Set(s).add(id));
    setManual(null);
  };

  if (display === HANDOFF) {
    const walletMissing = !hasTradingAccount(me);
    return (
      <PageShell>
        <XConnectedNotice />
        <Section label="Onboarding complete">
          <Panel>
            <h1>You&apos;re set. Go find a Pass.</h1>
            <p className="pass-stale">
              Your identity, profile{walletMissing ? "" : ", wallet"} and reputation
              are linked. Takers read your thesis and your track record from here.
            </p>
            {walletMissing ? (
              <p className="pass-validation" role="note">
                No wallet linked — taking a Pass will ask you to connect one first.
              </p>
            ) : null}
            <Inline gap="3">
              <Link className="pass-btn" data-variant="primary" href="/discover">
                Explore Passes
              </Link>
              {me.profileSlug ? (
                <Link className="pass-btn" data-variant="ghost" href={`/u/${me.profileSlug}`}>
                  See my profile
                </Link>
              ) : null}
            </Inline>
          </Panel>
        </Section>
      </PageShell>
    );
  }

  return (
    <>
      <XConnectedNotice />
      <OnboardingClient
        step={display}
        progress={progress}
        probe={async () => true}
        onAction={onAction}
        onSkip={onSkip}
        onBack={display > 0 ? () => setManual(display - 1) : undefined}
        stepBody={
          display === 1 ? (
            <Stack gap="4">
              <Field label="Slug">
                {({ controlId }) => (
                  <TextInput
                    id={controlId}
                    value={slug}
                    onChange={setSlug}
                    placeholder="traderx"
                  />
                )}
              </Field>
              <Field label="Display name">
                {({ controlId }) => (
                  <TextInput
                    id={controlId}
                    value={displayName}
                    onChange={setDisplayName}
                    placeholder="Trader X"
                  />
                )}
              </Field>
              <Field label="Bio">
                {({ controlId }) => (
                  <Textarea id={controlId} value={bio} onChange={setBio} />
                )}
              </Field>
            </Stack>
          ) : display === 2 ? (
            <Stack gap="4">
              <WalletControl showNote />
              {address ? (
                <p className="pass-stale">
                  Ready to link <span className="pass-num">{truncateAddress(address)}</span>.
                  Only the address leaves this browser — never a key.
                </p>
              ) : null}
              <p className="pass-stale">
                Taking a Pass requires a connected wallet. You can continue
                without one and link it later.
              </p>
              <Inline gap="3">
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="ghost"
                  onClick={() => onSkip("hyperliquid")}
                >
                  Continue without a wallet
                </button>
              </Inline>
            </Stack>
          ) : display === 3 && (ethosResult || ethosFailed) ? (
            <Stack gap="4">
              {ethosResult && !ethosFailed ? (
                <>
                  <p className="pass-stale">
                    Credibility score:{" "}
                    <span className="pass-num">{ethosResult.credibilityScore}</span>
                    {ethosResult.reviewsCount !== null
                      ? ` · ${ethosResult.reviewsCount} reviews`
                      : null}
                    {ethosResult.vouchesCount !== null
                      ? ` · ${ethosResult.vouchesCount} vouches`
                      : null}
                  </p>
                  <p className="pass-stale">{ethosResult.disclaimer}</p>
                </>
              ) : (
                <p className="pass-stale">
                  Ethos has no reputation for this identity yet — we&apos;ll
                  refresh it later. Nothing is blocked.
                </p>
              )}
              <Inline gap="3">
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="primary"
                  onClick={() => setManual(null)}
                >
                  Continue
                </button>
              </Inline>
            </Stack>
          ) : null
        }
      />
    </>
  );
}

export default OnboardingFlow;
