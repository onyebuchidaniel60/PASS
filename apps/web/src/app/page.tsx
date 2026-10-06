/**
 * PASS Landing — design/DESIGN.md §10.1, docs/UX_SPEC.md §4.
 *
 * Eye order is a testable requirement, not a suggestion (§10): hero line, then
 * the two CTAs, then the loop strip, then the support line.
 *
 * This screen has no async surface, so the empty/loading/error states the
 * per-screen contract asks for DO NOT APPLY and the reason is recorded rather
 * than faked with a spinner: there is no request to be in a loading state for.
 * A fabricated loading state on a screen with no data dependency would be a lie
 * about the pipeline. The one state that DOES exist is the reduced-motion path,
 * which is asserted in the test.
 */
import Link from "next/link";

import {
  ChamferPanel,
  GridField,
  Inline,
  PageShell,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import { CoordinatePair, Reticle, SignalLine } from "@/components/wave1/signature";
import { Button } from "@/components/wave2/controls";

/**
 * §10.1 item 3 — the loop, as a five-step statement. No illustration (§12.2).
 * The wording is the product's own, not a paraphrase.
 */
const LOOP = [
  { step: "01", label: "X post" },
  { step: "02", label: "Pass" },
  { step: "03", label: "trader context" },
  { step: "04", label: "trade plan" },
  { step: "05", label: "Hyperliquid" },
];

export default function LandingPage() {
  return (
    <PageShell>
      <ShellContent>
        {/* §8.2 GridField behind the HERO only — never behind body content. */}
        <section className="pass-landing" aria-label="PASS">
          <div className="pass-landing-field">
            <GridField />
          </div>

          <div className="pass-landing-hero">
            {/* §1.3 The hero line is fixed by PRD §18 and UX_SPEC §4. */}
            <h1 className="pass-hero-line">
              See a trade. Know the trader. Take the trade.
            </h1>

            {/* §10.1 item 1 — one SignalLine, reveal once, with one reticle. */}
            <SignalLine
              reveal
              node={<Reticle label="Signal line origin" />}
            />
          </div>

          {/* §10.1 item 2 — Explore Passes is the single accent-filled button;
              Create a Pass is ghost IMMEDIATELY after and never accented. */}
          <Inline gap="3" className="pass-landing-ctas">
            <Link href="/discover" className="pass-landing-cta-primary">
              <Button variant="primary" size="lg">
                Explore Passes
              </Button>
            </Link>
            <Link href="/passes/new" className="pass-landing-cta-ghost">
              <Button variant="ghost" size="lg">
                Create a Pass
              </Button>
            </Link>
          </Inline>

          {/* §10.1 item 3 — the five-step loop. */}
          <Section label="The loop" className="pass-landing-loop">
            <ChamferPanel label="The product loop, as five steps">
              <Stack gap="4">
                <ol className="pass-loop-strip">
                  {LOOP.map((s) => (
                    <li key={s.step} className="pass-loop-step">
                      <CoordinatePair label={s.step} value={s.label} />
                    </li>
                  ))}
                </ol>
              </Stack>
            </ChamferPanel>
          </Section>

          {/* §10.1 item 4 — support line at --type-body-l, measure-capped. */}
          <p className="pass-landing-support">
            PASS turns Hyperliquid trade plans into shareable, executable links.
          </p>
        </section>
      </ShellContent>
    </PageShell>
  );
}
