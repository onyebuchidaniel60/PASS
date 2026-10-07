import type { Metadata } from "next";

import { PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";
import {
  ChipBar,
  ChipButton,
  DataCard,
  DisplayHeadline,
  NumberedEyebrow,
  StatusBadge,
  Surface,
  type StatusTone,
} from "@/components/reference";

export const metadata: Metadata = {
  title: "PASS — Help",
  description: "Common topics, answers, and a route to a human.",
};

interface Topic {
  title: string;
  body: string;
  to: string;
}

/**
 * §14 Help. Search is presentational and states its own behaviour rather than
 * pretending to filter: wiring a client-side index over static content that a
 * browser can already Ctrl-F would be a fake feature. The input exists so the
 * page has the affordance the reference language calls for, and it says plainly
 * that it filters nothing yet — which is the honest version of shipping one.
 */
const TOPICS: Topic[] = [
  {
    title: "Taking your first Pass",
    body: "Read the plan, choose your size, tick consent, authorize. If the size field starts empty that is deliberate: the size is yours to choose, not a default you accepted.",
    to: "/faqs#copy",
  },
  {
    title: "Agent wallet approval",
    body: "Approving an agent wallet is what lets PASS sign an order without ever seeing your private key. It is a one-time signature from your master wallet.",
    to: "/faqs#funds",
  },
  {
    title: "Reading a trader's record",
    body: "PASS performance and Ethos reputation are shown separately and never merged. One is what happened here, the other is what happened elsewhere.",
    to: "/faqs",
  },
  {
    title: "Expired and cancelled Passes",
    body: "An expired or cancelled Pass cannot be taken. It stays readable, because a plan is worth reading after it has closed.",
    to: "/faqs",
  },
  {
    title: "Market data and prices",
    body: "Every price PASS shows comes from Hyperliquid and is attributed. There is no aggregated book and no unattributed figure.",
    to: "/faqs",
  },
  {
    title: "Something looks wrong",
    body: "Tell us what you saw and where. Include the link, because a plan is immutable and the version is part of the record.",
    to: "/contact",
  },
];

/**
 * `id` is the subject and `label` is the state. They are deliberately different
 * words: a card whose header and whose badge both read "Working" announces the
 * same thing twice and leaves the subject unnamed.
 */
const STATES: { id: string; tone: StatusTone; label: string; body: string }[] = [
  {
    id: "Trading and taking",
    tone: "active",
    label: "Working",
    body: "Plans resolve, orders authorize, executions record.",
  },
  {
    id: "Market data",
    tone: "entry_pending",
    label: "Watching",
    body: "Published plans waiting on their entry.",
  },
  {
    id: "Contact routing",
    tone: "cancelled",
    label: "Not started",
    body: "Contact routing is manual in the MVP.",
  },
];

export default function HelpPage() {
  return (
    <PageShell>
      <ShellContent>
        <Surface strength="section" className="pass-info-shell">
          <NumberedEyebrow label="Help" number={1} />
          <DisplayHeadline
            section
            lines={[
              [{ text: "Find the", accent: true }, { text: "answer" }],
              [{ text: "without", accent: true }, { text: "a", accent: true }, { text: "ticket." }],
            ]}
          />
          <div className="pass-help-search">
            <label className="pass-field-label" htmlFor="help-search">
              Search help topics
            </label>
            <input
              className="pass-control"
              id="help-search"
              type="search"
              placeholder="agent wallet, expiry, reputation"
              aria-describedby="help-search-note"
            />
            <p className="pass-field-helper" id="help-search-note">
              Search covers these topics on this page. Nothing is filtered yet — use
              your browser's own find.
            </p>
          </div>
        </Surface>

        <Section label="Topics">
          <Stack gap="5">
            <NumberedEyebrow label="Topics" number={2} />
            <ChipBar>
              {TOPICS.map((t) => (
                <ChipButton key={t.title} href={t.to}>
                  {t.title}
                </ChipButton>
              ))}
            </ChipBar>
            <div className="pass-info-cards">
              {TOPICS.map((t) => (
                <DataCard
                  key={t.title}
                  id={t.title}
                  prose
                  value={t.body}
                  action={{ label: "Read more", href: t.to }}
                />
              ))}
            </div>
          </Stack>
        </Section>

        <Section label="Service status">
          <Stack gap="5">
            <NumberedEyebrow label="Where things stand" number={3} />
            <div className="pass-info-cards">
              {STATES.map((s) => (
                <DataCard
                  key={s.label}
                  id={s.id}
                  prose
                  value={s.body}
                  headerAside={<StatusBadge tone={s.tone} label={s.label} />}
                />
              ))}
            </div>
            <p className="pass-landing-support">
              Still stuck? <a href="/contact">Contact us</a> or read the{" "}
              <a href="/faqs">FAQs</a>.
            </p>
          </Stack>
        </Section>
      </ShellContent>
    </PageShell>
  );
}
