import type { Metadata } from "next";

import { PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";
import {
  CornerBracketFrame,
  DataCard,
  DisplayHeadline,
  MetricCard,
  MetricCardRow,
  NumberedEyebrow,
  StepGrid,
  Surface,
  type StepSpec,
} from "@/components/reference";

// §14.4 copy lives in a module with no "use client": a Server Component
// importing a plain value from a client module gets a client-reference proxy,
// and the value is undefined at prerender. See lib/hero-copy.ts.
import { heroLines } from "@/lib/hero-copy";

export const metadata: Metadata = {
  title: "PASS — How it works",
  description:
    "How a PASS trade plan is authored, published, taken and settled on Hyperliquid.",
};

/**
 * §14.10 the four user actions in the full 2x2 grid, with the data each step
 * actually concerns in its visual slot. §14.10 forbids an image there, so the
 * slot carries figures rather than a picture.
 */
const STEPS: StepSpec[] = [
  {
    step: 1,
    title: "Author the plan",
    body: "A trader writes the asset, the direction, an entry, a take profit, a stop and the reasoning behind all three. Nothing is published until the numbers agree with each other.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Asset" value="BTC" />
        <MetricCard label="Direction" value="Long" />
        <MetricCard label="Entry" value="$113.4K" />
        <MetricCard label="Leverage" value="3x" />
      </MetricCardRow>
    ),
    footLabel: "Draft",
  },
  {
    step: 2,
    title: "Publish the link",
    body: "The plan gets an immutable link and a version number. Every later read and every later execution is recorded against that version, so the words can always be recovered.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Reads" value="1,284" />
        <MetricCard label="Version" value="v3" />
      </MetricCardRow>
    ),
    footLabel: "Active",
  },
  {
    step: 3,
    title: "Take it yourself",
    body: "You choose your own position size, read the whole plan, and authorize the order from your own wallet. A Hyperliquid agent wallet signs on your behalf so you never paste a private key into a web page.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Your size" value="0.42 ETH" />
        <MetricCard label="Notional" value="$47.6K" />
        <MetricCard label="Signed by" value="Agent" />
      </MetricCardRow>
    ),
    footLabel: "Authorized",
  },
  {
    step: 4,
    title: "Settle and record",
    body: "The fill lands in your own account. PASS records the execution against the plan version so the outcome can be read next to the reasoning that produced it.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Entry fill" value="$113.4K" />
        <MetricCard label="Realized" value="+$1,284" />
        <MetricCard label="Venue" value="HL" />
      </MetricCardRow>
    ),
    footLabel: "Recorded",
  },
];

const FAQ_TEASER = [
  {
    id: "funds",
    title: "Who holds my funds?",
    body: "You do. The order is signed by an agent wallet that lives in your browser and is authorized by your master wallet. PASS never receives a private key and never custodies a balance.",
  },
  {
    id: "copy",
    title: "Is PASS copy trading?",
    body: "No. Nothing is copied and nothing is executed automatically. You read the plan, choose your own size, and authorize your own order.",
  },
];

export default function HowItWorksPage() {
  return (
    <PageShell>
      <ShellContent>
        <Surface strength="section" className="pass-info-shell">
          <NumberedEyebrow label="How it works" number={1} />
          <DisplayHeadline
            section
            lines={heroLines("howItWorks")}
          />
          <p className="pass-landing-lede">
            A Pass is a trade plan with an author attached to it. Here is the whole
            path from a trader's keyboard to a fill in your own account.
          </p>
        </Surface>

        <Section label="The four steps">
          <Stack gap="5">
            <NumberedEyebrow label="The four steps" number={2} />
            {/* §14.2 the third of four bracket frames in the product. */}
            <CornerBracketFrame labelledBy="how-steps">
              <h2 className="visually-hidden" id="how-steps">
                The four steps of a Pass
              </h2>
              <StepGrid steps={STEPS} />
            </CornerBracketFrame>
          </Stack>
        </Section>

        <Section label="What a Pass is not">
          <Stack gap="5">
            <NumberedEyebrow label="What a Pass is not" number={3} />
            <div className="pass-info-cards">
              {FAQ_TEASER.map((f) => (
                <DataCard key={f.id} id={f.title} prose value={f.body} />
              ))}
            </div>
            <p className="pass-landing-support">
              The full list is in the FAQs.
            </p>
          </Stack>
        </Section>
      </ShellContent>
    </PageShell>
  );
}
