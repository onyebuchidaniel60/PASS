import type { Metadata } from "next";

import { PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";
import {
  ChipButton,
  DisplayHeadline,
  NumberedEyebrow,
  Surface,
} from "@/components/reference";

export const metadata: Metadata = {
  title: "PASS — FAQs",
  description:
    "What a Pass is, who holds your funds, what an agent wallet is, and what happens when a Pass expires.",
};

/**
 * §14 / UX_SPEC: real questions, answered without hedging.
 *
 * Every answer is a fact the product can stand behind today. Where the honest
 * answer is "not yet", it says that rather than filling the gap (docs/DECISIONS.md
 * D-008, DESIGN.md §12.4).
 */
const FAQS = [
  {
    q: "What is a Pass?",
    a: "A Pass is a structured Hyperliquid trade plan with an author attached to it: an asset, a direction, an entry, a take profit, a stop, and the trader's reasoning. It has an immutable link and a version number, so the plan you read is the plan that was live when you read it.",
  },
  {
    q: "Is PASS copy trading?",
    a: "No. Nothing is copied and nothing is executed automatically. You read the plan, choose your own position size, and authorize your own order. If you never sign, nothing happens.",
  },
  {
    q: "Who holds my funds?",
    a: "You do, in your own Hyperliquid account. PASS relays a signature you authorized; it never receives a private key, never custodies a balance, and cannot move funds on its own.",
  },
  {
    q: "What is a Hyperliquid agent wallet?",
    a: "It is a second key, generated in your browser, that your master wallet authorizes once to sign orders on your behalf. It means you can approve a plan without pasting a private key into a web page. The agent key is stored encrypted in your browser and never sent to PASS.",
  },
  {
    q: "What happens if a Pass expires?",
    a: "It can no longer be taken, and it moves to an expired state that says so. The page stays readable, because a trader-authored plan is worth reading after it has closed.",
  },
  {
    q: "What is Ethos?",
    a: "External reputation context about a trader's history, shown separately from PASS performance and never merged into one score. PASS performance is what happened inside PASS; Ethos is what happened elsewhere. They answer different questions.",
  },
  {
    q: "Where does the market data come from?",
    a: "Hyperliquid. PASS does not run its own book, does not aggregate venues, and does not show a price it cannot attribute.",
  },
  {
    q: "Can a trader delete a Pass after someone has taken it?",
    a: "No. Cancelling stops new takers, but the record and its execution history stay readable. That is what makes the outcome auditable against the words that produced it.",
  },
];

export default function FaqsPage() {
  return (
    <PageShell>
      <ShellContent>
        <Surface strength="section" className="pass-info-shell">
          <NumberedEyebrow label="FAQs" number={1} />
          <DisplayHeadline
            section
            lines={[
              [{ text: "The", accent: true }, { text: "questions" }, { text: "people" }, { text: "ask." }],
              [{ text: "Answered" }, { text: "without", accent: true }, { text: "hedging." }],
            ]}
          />
        </Surface>

        <Section label="Frequently asked questions">
          <Stack gap="4">
            <NumberedEyebrow label="Frequently asked questions" number={2} />
            <div className="pass-faq-list">
              {FAQS.map((f) => (
                <details className="pass-faq" key={f.q}>
                  <summary className="pass-faq-question">{f.q}</summary>
                  <p className="pass-faq-answer">{f.a}</p>
                </details>
              ))}
            </div>
            <div className="pass-chip-bar">
              <ChipButton href="/help">More in Help</ChipButton>
              <ChipButton href="/contact">Contact us</ChipButton>
            </div>
          </Stack>
        </Section>
      </ShellContent>
    </PageShell>
  );
}
