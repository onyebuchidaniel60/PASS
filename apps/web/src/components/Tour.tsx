"use client";

/**
 * First-time tour (docs/DECISIONS.md D-022) — six overlay cards introducing
 * the shared topbar, the four primary surfaces, Settings and authoring.
 *
 * Deliberately spare: text plus Next/Back/Skip. No video, no entrance
 * animation (so the reduced-motion path is the only path), no hotspots.
 * The shell is the existing `Dialog`, which already traps focus, closes on
 * Escape, restores focus, and announces itself — the tour inherits all of
 * that rather than reimplementing it. Copy only from existing primitives;
 * no new tokens.
 */

import { useState } from "react";

import { Dialog } from "@/components/wave5/Dialog";

export interface TourStep {
  heading: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    heading: "The topbar.",
    body: "Search traders and Passes from the topbar, and open your X identity from the right. Network status lives on the home hero, where you can check it before you sign.",
  },
  {
    heading: "Discover Passes.",
    body: "Browse perps and prediction markets. Read the plan, the thesis and the invalidation before you commit to anything.",
  },
  {
    heading: "My Passes.",
    body: "Everything you authored lives here, with its live lifecycle state and the controls that are valid for that state.",
  },
  {
    heading: "Executions.",
    body: "Every fill is recorded against the exact Pass version that was live when you took it — your own record, not a copied position.",
  },
  {
    heading: "Settings.",
    body: "Funding, agent security, venue status and developer API keys are separated into focused tabs.",
  },
  {
    heading: "Create a Pass.",
    body: "Author a perp plan or a prediction-market plan. You set the thesis and the terms; the Taker chooses their own size.",
  },
];

export function Tour({ onDone }: { onDone: () => Promise<void> | void }) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0];
  const last = index >= TOUR_STEPS.length - 1;

  const finish = async () => {
    setBusy(true);
    try {
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => void finish()}
      title={step.heading}
      action={
        <>
          {index > 0 ? (
            <button
              type="button"
              className="pass-btn"
              data-variant="ghost"
              disabled={busy}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              Back
            </button>
          ) : null}
          {!last ? (
            <button
              type="button"
              className="pass-btn"
              data-variant="primary"
              disabled={busy}
              onClick={() => setIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="pass-btn"
              data-variant="primary"
              disabled={busy}
              onClick={() => void finish()}
            >
              {busy ? "Saving" : "Done"}
            </button>
          )}
          <button
            type="button"
            className="pass-btn"
            data-variant="ghost"
            disabled={busy}
            onClick={() => void finish()}
          >
            Skip
          </button>
        </>
      }
    >
      <p style={{ maxWidth: "var(--measure-body)" }}>{step.body}</p>
      <p className="pass-stale" aria-live="polite">
        {`STEP ${index + 1} / ${TOUR_STEPS.length}`}
      </p>
    </Dialog>
  );
}

export default Tour;
