import type { Metadata } from "next";

import { PageShell, Section, ShellContent, Stack } from "@/components/wave1/layout";
import {
  DataCard,
  DisplayHeadline,
  LiveDot,
  MetricCard,
  MetricCardRow,
  NumberedEyebrow,
  Surface,
} from "@/components/reference";
import { INFO } from "@/lib/nav";

export const metadata: Metadata = {
  title: "PASS — Contact",
  description: "How to reach PASS, and what to expect back.",
};

/**
 * §14 Contact. No backend form in the MVP (PRD §5 non-goals), and the page says
 * so rather than shipping a form that silently does nothing. A contact form that
 * discards its input is worse than no form, because it teaches the reader that
 * PASS does not answer.
 */
const CHANNELS = [
  {
    id: "Email",
    sub: "For anything with a link in it",
    value: "hello",
    unit: "@pass.trade",
    body: "Best for anything with a link in it. A Pass is immutable, so the link tells us exactly which version you read.",
    href: "mailto:hello@pass.trade",
  },
  {
    id: "X",
    sub: "Public, faster for small things",
    value: "@pass",
    unit: "trade",
    body: "For a broken link, a wrong figure, or a Pass that will not resolve. A screenshot of the page helps.",
    href: "https://x.com/pass",
  },
];

export default function ContactPage() {
  return (
    <PageShell>
      <ShellContent>
        <Surface strength="hero" className="pass-info-shell" labelledBy="contact-heading">
          <NumberedEyebrow label="Contact" number={1} />
          <DisplayHeadline
            section
            lines={[
              [{ text: "Tell", accent: true }, { text: "us" }],
              [{ text: "what", accent: true }, { text: "broke." }],
            ]}
          />
          <p className="pass-landing-lede" id="contact-heading">
            Replies come within 24 hours on weekdays. There is no contact form in
            the MVP, so this page gives you the two addresses that actually reach
            a person.
          </p>
        </Surface>

        <Section label="How to reach us">
          <Stack gap="5">
            <NumberedEyebrow label="How to reach us" number={2} />
            <div className="pass-info-cards">
              {CHANNELS.map((c) => (
                <DataCard
                  key={c.id}
                  id={c.id}
                  sub={c.sub}
                  value={c.value}
                  unit={c.unit}
                  headerAside={<LiveDot label="Monitored" />}
                  action={{ label: `Email ${c.id}`, href: c.href }}
                />
              ))}
            </div>
          </Stack>
        </Section>

        <Section label="Before you write">
          <Stack gap="5">
            <NumberedEyebrow label="Before you write" number={3} />
            <MetricCardRow>
              <MetricCard label="Typical reply" value="< 24h" sub="weekdays" />
              <MetricCard label="Include" value="The link" sub="it identifies the version" />
              <MetricCard label="Fastest for" value="X" sub="small things" />
            </MetricCardRow>
            <p className="pass-landing-support">
              Most questions are already answered on{" "}
              {INFO.filter((i) => i.href !== "/contact").map((i, n) => (
                <span key={i.href}>
                  {n > 0 ? ", " : ""}
                  <a href={i.href}>{i.label}</a>
                </span>
              ))}
              .
            </p>
          </Stack>
        </Section>
      </ShellContent>
    </PageShell>
  );
}
