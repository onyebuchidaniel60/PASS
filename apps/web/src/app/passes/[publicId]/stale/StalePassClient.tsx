"use client";

/**
 * Stale Pass interstitial — design/DESIGN.md §10.7, docs/UX_SPEC.md §9.
 *
 * Replaces the page when the reviewed parameters are no longer current.
 * Execution is NEVER silently attempted on stale parameters, so this route
 * offers no path into the Take flow.
 *
 * Served as a route at /passes/{publicId}/stale so it can be linked and tested
 * in isolation, and as a Dialog on the Pass page when the version changes under
 * the reader.
 */

import Link from "next/link";
import { useState } from "react";

import { Inline, PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";

import { StaleInterstitial } from "@/components/wave5/Dialog";

export function StalePassClient({ publicId }: { publicId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          <Section label="Stale Pass">
            {/* §10.7 item 1 — a plain statement, no stack trace, no error code. */}
            <h1 className="pass-asset-line">This Pass changed.</h1>
            <p className="pass-thesis" style={{ marginBlockStart: "var(--space-4)" }}>
              The trade parameters you reviewed are no longer current.
            </p>
          </Section>

          {/* §10.7 item 2 — Review latest Pass is the only accent on screen. */}
          <Inline gap="4">
            <Link href={`/p/${publicId}`} className="pass-link-btn">
              Review latest Pass
            </Link>
            <Link href="/discover" className="pass-link-btn">
              Explore Passes
            </Link>
            <button
              type="button"
              className="pass-link-btn"
              onClick={() => setOpen(true)}
              style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
            >
              View what changed
            </button>
          </Inline>

          <p className="pass-stale">
            Nothing was executed. A Pass is only ever taken against the
            parameters you can currently see.
          </p>

          {/* §10.7 item 3 — the mono diff, shown as an overlay. */}
          <StaleInterstitial
            open={open}
            onReviewLatest={() => setOpen(false)}
            onDismiss={() => setOpen(false)}
            changes={[]}
          />
        </Stack>
      </ShellContent>
    </PageShell>
  );
}