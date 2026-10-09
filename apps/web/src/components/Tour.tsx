"use client";

/**
 * First-time tour (docs/DECISIONS.md D-022) — five overlay cards introducing
 * the four primary surfaces and the Take flow.
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
    heading: "Discover Passes.",
    body: "Browse trader-authored trade plans — asset, direction, entry, profit target and stop — before you commit to anything.",
  },
  {
    heading: "Take a Pass.",
    body: "You choose your own position size and authorize your own Hyperliquid order. Nothing is copied automatically.",
  },
  {
    heading: "Track your Passes.",
    body: "My Passes holds everything you authored, with its live lifecycle state.",
  },
  {
    heading: "Audit every fill.",
    body: "Executions records each fill against the exact Pass version that was live when you took it.",
  },
  {
    heading: "Your Trader profile.",
    body: "Your thesis, your track record and your reputation context live here. You can re-open this tour from settings any time.",
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
