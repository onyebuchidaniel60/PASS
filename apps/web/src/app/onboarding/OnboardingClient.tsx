"use client";

/**
 * Onboarding (§10.11, PRD §8.1) — ONE STEP PER SCREEN.
 *
 * The four steps are declared as DATA here and the screen renders whichever one
 * it is given. That is what "one step per screen" means structurally: a step is
 * a question, an action, and one sentence of justification — never a four-field
 * form the Trader has to reason about all at once.
 *
 * Spec points encoded:
 *  - the step's single question is a display-size statement (`Connect your X
 *    identity.`);
 *  - the action is accent-filled and NAMED FOR WHAT IT DOES (`Connect X`, not
 *    "Continue");
 *  - "why it is needed" is ONE sentence in secondary body. Not a permissions
 *    essay. Each `why` below is deliberately short;
 *  - progress is mono `STEP 2 / 4`;
 *  - a step whose provider is unavailable shows `UnavailableBlock` and may be
 *    SKIPPED where the PRD permits it (Ethos is `optional: true`, and only
 *    because the PRD marks reputation resolution "if available").
 *
 * Nothing here collects key material. The agent wallet is generated client-side;
 * no seed phrase or private key is ever requested, echoed or displayed (AGENTS.md).
 */

import { useState } from "react";

import { PermissionBlock, UnavailableBlock } from "@/components/wave3/data";
import { Inline, PageShell, Panel, Section, Stack } from "@/components/wave1/layout";
import { Eyebrow } from "@/components/wave1/signature";
import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";

export type StepId = "x" | "profile" | "hyperliquid" | "ethos";

export interface Step {
  id: StepId;
  /** The single question, at display size. */
  question: string;
  /** Named for what it does. */
  action: string;
  /** ONE sentence. Not a permissions essay. */
  why: string;
  /** The PRD permits skipping only where this is true. */
  optional: boolean;
}

export const STEPS: Step[] = [
  {
    id: "x",
    question: "Connect your X identity.",
    action: "Connect X",
    why: "Your Passes and taker record are tied to an X identity.",
    optional: false,
  },
  {
    id: "profile",
    question: "Create your PASS profile.",
    action: "Create profile",
    why: "A profile is where takers read your thesis and your track record.",
    optional: false,
  },
  {
    id: "hyperliquid",
    question: "Associate your Hyperliquid account.",
    action: "Generate agent wallet",
    why: "Takers authorize against your plan, you fill against your own account.",
    optional: false,
  },
  {
    id: "ethos",
    question: "Resolve your Ethos reputation.",
    action: "Resolve Ethos",
    why: "Reputation gives takers a signal they can read before they commit.",
    optional: true,
  },
];

export interface StepProgress {
  step: StepId;
  complete: boolean;
  /** The provider cannot be reached right now. */
  unavailable?: boolean;
  /** A failure specific to THIS step. Does not disturb the other steps. */
  error?: string;
}

export function OnboardingClient({
  step = 0,
  progress,
  probe,
  onAction,
  onSkip,
}: {
  step?: number;
  progress?: StepProgress[];
  /** Injectable session probe; defaults to `/api/v1/me` via the hook. */
  probe?: () => Promise<boolean>;
  onAction?: (id: StepId) => Promise<void>;
  onSkip?: (id: StepId) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const current = STEPS[step] ?? STEPS[0];
  const state = progress?.find((p) => p.step === current.id);
  const error = localError ?? state?.error;

  // Onboarding is reachable signed-out by design — the first step IS connecting
  // an identity — so a failed probe is not an unauthorized state here. It only
  // blocks once the profile step needs an authenticated read.
  const needsAuth = step > 0;
  const { state: resource } = useAuthenticatedResource<unknown>({
    probe: needsAuth ? probe : async () => true,
    load: async () => ({}),
  });

  const run = async () => {
    if (!onAction) return;
    setBusy(true);
    setLocalError(null);
    try {
      await onAction(current.id);
    } catch (e) {
      // §10.11: the error belongs to this step alone; the other three are
      // untouched and stay exactly as they were.
      setLocalError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  if (needsAuth && resource.status === "unauthorized") {
    return (
      <PageShell>
        <Section label="Onboarding">
          <Stack gap="6">
            <StepProgressMono step={step} />
            <PermissionBlock reason="Finish connecting X to continue onboarding." />
          </Stack>
        </Section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Section label="Onboarding">
        <Stack gap="6">
          <StepProgressMono step={step} />

          {state?.unavailable ? (
            <Stack gap="4">
              <UnavailableBlock
                provider={current.action}
                detail={
                  current.optional
                    ? "This provider cannot be reached right now. You can finish this later."
                    : "This provider cannot be reached right now. Authoring a Pass needs it."
                }
              />
              {current.optional ? (
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="secondary"
                  onClick={() => onSkip?.(current.id)}
                >
                  Skip for now
                </button>
              ) : null}
            </Stack>
          ) : (
            <Panel>
              <h1>{current.question}</h1>
              <p className="pass-stale">{current.why}</p>

              <Inline gap="3">
                <button
                  type="button"
                  className="pass-btn"
                  data-variant="primary"
                  disabled={busy}
                  onClick={run}
                >
                  {busy ? "Working" : current.action}
                </button>
                {current.optional ? (
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="ghost"
                    onClick={() => onSkip?.(current.id)}
                  >
                    Skip for now
                  </button>
                ) : null}
              </Inline>

              {error ? (
                <p className="pass-validation" role="alert">
                  {error}
                </p>
              ) : null}
            </Panel>
          )}
        </Stack>
      </Section>
    </PageShell>
  );
}

/** §10.11: progress is mono text, `STEP 2 / 4`. */
function StepProgressMono({ step }: { step: number }) {
  return (
    <Eyebrow>{`STEP ${Math.min(step + 1, STEPS.length)} / ${STEPS.length}`}</Eyebrow>
  );
}