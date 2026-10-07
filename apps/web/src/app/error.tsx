"use client";

/**
 * §10.12 Generic error boundary.
 *
 * Calm under failure (§1.2): states what happened and what to do next. No
 * exclamation marks, no apology, no "oops". The stack trace and the error
 * message are deliberately NOT rendered — this surface is reachable by anyone
 * with the URL.
 */
import { useEffect } from "react";

import { Inline, PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";

import { Button } from "@/components/wave2/controls";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The message is logged for operators, never rendered. It can carry data
    // that should not be shown to whoever loaded the URL.
    console.error("[pass-web] render error", error.digest ?? "", error.message);
  }, [error]);

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          <Section label="Error">
            <h1 className="pass-asset-line">Something failed.</h1>
            <p className="pass-thesis" style={{ marginBlockStart: "var(--space-4)" }}>
              This page could not be loaded. Retrying often clears it. If it
              does not, the Pass may have changed.
            </p>
          </Section>
          <Inline gap="4">
            <Button variant="primary" size="md" onClick={reset}>
              Retry
            </Button>
            <Inline gap="4">
              <a href="/discover" className="pass-link-btn">
                Explore Passes
              </a>
              <a href="/" className="pass-link-btn">
                Go to the start
              </a>
            </Inline>
          </Inline>
          {/* §10.12 item 3 — a mono reference id, tertiary. This is the only
              place an identifier appears. */}
          {error.digest ? (
            <p className="pass-stale">Reference {error.digest}</p>
          ) : null}
        </Stack>
      </ShellContent>
    </PageShell>
  );
}