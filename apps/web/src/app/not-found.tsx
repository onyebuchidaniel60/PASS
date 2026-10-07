import Link from "next/link";

import { Inline, PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";

/**
 * §10.12 Not found.
 *
 * A plain statement at display size, no stack trace and no error code as the
 * headline, then EXACTLY ONE accent action.
 */
export default function NotFound() {
  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          <Section label="Not found">
            <h1 className="pass-asset-line">This page does not exist.</h1>
            <p className="pass-thesis" style={{ marginBlockStart: "var(--space-4)" }}>
              The Pass or profile you asked for is not here. It may have been
              cancelled, or the link may be wrong.
            </p>
          </Section>
          {/* §10.12 — exactly one accent-filled action. */}
          <Inline gap="4">
            <Link href="/discover" className="pass-link-btn">
              Explore Passes
            </Link>
            <Link href="/" className="pass-link-btn">
              Go to the start
            </Link>
          </Inline>
        </Stack>
      </ShellContent>
    </PageShell>
  );
}