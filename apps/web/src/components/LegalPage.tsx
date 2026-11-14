import {
  PageShell,
  Panel,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";

export interface LegalSection {
  heading: string;
  body: string[];
}

/**
 * Shared shell for the two legal pages linked from the footer. Keeping the
 * copy in the page files and the layout here means Terms and Privacy cannot
 * drift into two different type scales.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <PageShell>
      <ShellContent className="pass-legal">
        <Section label={title}>
          <Stack gap="6">
            <Stack gap="3">
              <span className="pass-settings-kicker">{eyebrow}</span>
              <h1 className="pass-display">{title}</h1>
              <p className="pass-stale">Last updated {updated}</p>
              <p className="pass-thesis">{intro}</p>
            </Stack>

            <Stack gap="4">
              {sections.map((section) => (
                <Panel key={section.heading}>
                  <Stack gap="3">
                    <h2 className="pass-legal-heading">{section.heading}</h2>
                    {section.body.map((paragraph) => (
                      <p key={paragraph} className="pass-legal-copy">
                        {paragraph}
                      </p>
                    ))}
                  </Stack>
                </Panel>
              ))}
            </Stack>
          </Stack>
        </Section>
      </ShellContent>
    </PageShell>
  );
}
