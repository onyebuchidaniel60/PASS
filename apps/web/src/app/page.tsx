/**
 * PASS Landing — design/DESIGN.md §10.1 and §14, docs/UX_SPEC.md §4.
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
 *
 * REBUILT 2026-10-07 against §14. The previous version satisfied every clause in
 * §§1–13 and still read as a generic dark theme, because §14 did not exist yet:
 * a flat canvas, no grain, no corner brackets, a hero line at 4.5rem in a normal
 * weight with no ember accent word, no numbered eyebrows, and no step grid. The
 * §10.1 contract is unchanged — same copy, same eye order, same two CTAs, same
 * single accent fill.
 */
import Link from "next/link";

import {
  GridField,
  Inline,
  PageShell,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import { CoordinatePair, Reticle, SignalLine } from "@/components/wave1/signature";
import { Button } from "@/components/wave2/controls";
import {
  ChipBar,
  ChipButton,
  CornerBracketFrame,
  DisplayHeadline,
  HERO_LINES,
  MetricCard,
  MetricCardRow,
  NumberedEyebrow,
  StepGrid,
  Surface,
  type StepSpec,
} from "@/components/reference";
import { INFO } from "@/lib/nav";

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

/**
 * §14.10 — the four user actions, in the 2x2 grid, in a data card per step's
 * visual slot. §14.10 forbids an image in that slot, so it carries the figures
 * the step is actually about rather than a picture of a person pointing.
 */
const STEPS: StepSpec[] = [
  {
    step: 1,
    title: "Author",
    body: "A trader writes the entry, the take profit, the stop and the thesis as one structured plan.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Entry" value="$113.4K" />
        <MetricCard label="Stop" value="$111.9K" />
      </MetricCardRow>
    ),
    footLabel: "Draft",
  },
  {
    step: 2,
    title: "Publish",
    body: "The plan becomes a link. Anyone can read it before a single dollar moves.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Reads" value="1,284" />
        <MetricCard label="Takes" value="37" />
      </MetricCardRow>
    ),
    footLabel: "Active",
  },
  {
    step: 3,
    title: "Take",
    body: "You choose your own size and authorize your own order. PASS never holds a key.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Your size" value="0.42 ETH" />
        <MetricCard label="Leverage" value="3x" />
      </MetricCardRow>
    ),
    footLabel: "Authorized",
  },
  {
    step: 4,
    title: "Settle",
    body: "The fill lands in your own account and the execution is recorded against the plan version.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Realized" value="+$1,284" />
        <MetricCard label="Venue" value="HL" />
      </MetricCardRow>
    ),
    footLabel: "Recorded",
  },
];

export default function LandingPage() {
  return (
    <PageShell>
      <ShellContent>
        {/* §14.1 the hero is the one surface that gets the full wash, the grain
            and the ghost watermark. All three are absolutely positioned inside
            this clipping shell, which is what stops them painting over the
            sections below (§14.15 rule 4 — the operator's "overlay on other
            elements"). */}
        <Surface strength="hero" watermark="PASS" className="pass-landing-shell">
          {/* §8.2 structural column rules behind the HERO only, never behind
              body content. §14.1's wash is a separate layer and the two compose:
              the wash is the field, the column rules are the grid inside it. */}
          <div className="pass-landing-field">
            <GridField />
          </div>

          {/* §14.2 one of exactly four bracket frames in the product. */}
          <CornerBracketFrame className="pass-landing-frame" labelledBy="landing-hero">
            <div className="pass-landing-hero">
              {/* §14.4 the hero is three authored lines with ONE ember word,
                  on line one. Not a single wrapped sentence. */}
              <DisplayHeadline lines={HERO_LINES.landing.map((l) => l.map((w) => ({ ...w })))} />
              <p className="pass-landing-lede" id="landing-hero">
                A trader publishes a Hyperliquid plan. You read it, size it yourself,
                and authorize it with your own wallet. Nothing is copied and no key
                ever leaves your browser.
              </p>

              {/* §10.1 item 1 — one SignalLine, reveal once, with one reticle. */}
              <SignalLine reveal node={<Reticle label="Signal line origin" />} />
            </div>
          </CornerBracketFrame>

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
        </Surface>

        {/* §14.3 section 01. */}
        <Section label="The loop">
          <Stack gap="4">
            <NumberedEyebrow label="The loop" number={1} />
            <ol className="pass-loop-strip">
              {LOOP.map((s) => (
                <li key={s.step} className="pass-loop-step">
                  <CoordinatePair label={s.step} value={s.label} />
                </li>
              ))}
            </ol>
          </Stack>
        </Section>

        {/* §14.10 section 02. The shortened version; /how-it-works carries the
            full copy. */}
        <Section label="How it works">
          <Stack gap="4">
            <NumberedEyebrow label="How it works" number={2} />
            <DisplayHeadline
              section
              as="h2"
              lines={HERO_LINES.howItWorks.map((l) => l.map((w) => ({ ...w })))}
            />
            {/* §14.2 the second of four bracket frames: one around the set,
                never one per card. */}
            <CornerBracketFrame labelledBy="landing-steps">
              <h3 className="visually-hidden" id="landing-steps">
                The four steps of a Pass
              </h3>
              <StepGrid steps={STEPS} />
            </CornerBracketFrame>
          </Stack>
        </Section>

        {/* §14.3 section 03. The informational pages as chips (§14.9), plus the
            support line §10.1 item 4 requires. */}
        <Section label="The network">
          <Stack gap="4">
            <NumberedEyebrow label="Read more" number={3} />
            <ChipBar>
              {INFO.map((i) => (
                <ChipButton key={i.href} href={i.href}>
                  {i.label}
                </ChipButton>
              ))}
            </ChipBar>
            {/* §10.1 item 4 — support line at --type-body-l, measure-capped. */}
            <p className="pass-landing-support">
              PASS turns Hyperliquid trade plans into shareable, executable links.
            </p>
          </Stack>
        </Section>
      </ShellContent>
    </PageShell>
  );
}
