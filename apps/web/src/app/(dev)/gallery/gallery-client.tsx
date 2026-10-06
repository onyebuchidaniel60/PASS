/**
 * Gallery client surface.
 *
 * Split out so `page.tsx` can stay a server component and call `notFound()` in
 * production, which removes the route from the build rather than hiding it.
 */
"use client";

import { useState } from "react";

import {
  ChamferPanel,
  GridField,
  Inline,
  PageShell,
  Panel,
  Rule,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import {
  CoordinateGrid,
  CoordinatePair,
  Eyebrow,
  Reticle,
  SectionNumber,
  SignalLine,
} from "@/components/wave1/signature";

import { reducedMotionPreviewCss } from "@/motion";

/** Realistic magnitudes from PASS's own domain. See SOURCES.md. */
const FIXTURES = {
  address: "0x7f3aC9b41E8d05A6f0B2c7E9d14A83f5C6b2D90E",
  shortAddress: "0x7f3a…D90E",
  entry: "113,400.00",
  tp: "116,000.00",
  sl: "111,900.00",
  size: "1,250.00 USDC",
  leverage: "5x",
  huge: "9,876,543.21",
  ethos: 1234567,
  eyebrow:
    "Trader-authored structured trade plan awaiting independent Taker authorization",
  thesis:
    "Funding has normalised after two consecutive prints above the ninety-fourth percentile, and open interest is still building on the break, so I want to work the continuation rather than the range. Invalidation sits below the prior swing low; the reward to the measured move target is close to four times the risk at the levels published here.",
  rowLabel:
    "Estimated margin required at the published entry and leverage",
};

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} style={{ padding: "var(--space-4) 0" }}>
      <Eyebrow>{title}</Eyebrow>
      <Rule />
      <div style={{ paddingTop: "var(--space-4)" }}>{children}</div>
    </section>
  );
}

function StressBlock({ label }: { label: string }) {
  return (
    <div
      data-pass-stress-width={label}
      style={{
        maxWidth: "var(--measure-body)",
        overflow: "auto",
        border: "var(--border-hairline)",
        padding: "var(--space-3)",
      }}
    >
      {label}
    </div>
  );
}

export function GalleryClient() {
  const [reduced, setReduced] = useState(false);

  return (
    <PageShell>
      {/* Injected as CSS because a matchMedia override cannot reach the
          @media rules the browser evaluates. */}
      <style>{reducedMotionPreviewCss()}</style>
      <ShellContent>
        <div data-pass-reduced-motion={String(reduced)}>
          <Eyebrow number={0}>component gallery</Eyebrow>

          <Inline gap="3">
            <button
              type="button"
              className="pass-action"
              onClick={() => setReduced((v) => !v)}
              aria-pressed={reduced}
            >
              {reduced ? "Reduced motion: ON" : "Reduced motion: OFF"}
            </button>
            <span className="pass-coordinate-pair-value">
              Development only. Not a product surface.
            </span>
          </Inline>

          <Rule />

          <Row title="layout and framing">
            <Stack gap="5">
              <Panel>
                <Stack gap="2">
                  <span>Panel — §2.2 surface, §5.3 hairline border, no radius.</span>
                  <span>Blocks inside a panel are separated by --space-5.</span>
                </Stack>
              </Panel>

              <ChamferPanel label="Chamfered key object">
                <Stack gap="2">
                  <span>ChamferPanel — §5.2 clip-path, no radius, no shadow.</span>
                  <span>At most one per viewport region, three per screen.</span>
                </Stack>
              </ChamferPanel>

              <ChamferPanel accentEdge label="Chamfered key object with accent edge">
                <span>Accent edge variant — §5.3 top edge only.</span>
              </ChamferPanel>

              <Inline gap="2">
                <span>Inline wraps by default (§8.5).</span>
                <span>gap 2</span>
                <span>gap 2</span>
              </Inline>

              <Section label="Section landmark">
                <span>Section — §4 --space-8 mobile / --space-9 desktop.</span>
              </Section>

              <Rule label="A meaningful divider" />
              <span>Rule above carries an accessible name.</span>

              <div style={{ position: "relative" }}>
                <GridField />
                <span style={{ position: "relative" }}>
                  GridField behind — §8.2 structural, hero only.
                </span>
              </div>
            </Stack>
          </Row>

          <Row title="signature devices">
            <Stack gap="5">
              <Eyebrow>default eyebrow</Eyebrow>
              <Eyebrow delimiter={false}>eyebrow without delimiters</Eyebrow>
              <Eyebrow number={3}>with a section number</Eyebrow>
              <SectionNumber value={12} />
              <SignalLine />
              <SignalLine reveal node={<Reticle label="Signal line origin" />} />
              <Reticle label="Standalone reticle" />
            </Stack>
          </Row>

          <Row title="coordinate pairs">
            <CoordinateGrid>
              <CoordinatePair label="ENTRY" value={FIXTURES.entry} />
              <CoordinatePair label="TP" value={FIXTURES.tp} size="l" />
              <CoordinatePair label="SL" value={FIXTURES.sl} />
              <CoordinatePair label="LEVERAGE" value={FIXTURES.leverage} />
            </CoordinateGrid>
            <div style={{ paddingTop: "var(--space-4)" }}>
              <CoordinatePair
                label="MASTER ADDRESS"
                value={FIXTURES.shortAddress}
                fullValue={FIXTURES.address}
              />
            </div>
          </Row>

          <Row title="narrow-width stress">
            <Stack gap="4">
              <StressBlock label="stress: long labels" />
              <div style={{ maxWidth: "var(--measure-body)" }}>
                <Eyebrow>{FIXTURES.eyebrow}</Eyebrow>
              </div>
              <div style={{ maxWidth: "var(--measure-thesis)" }}>
                <p>{FIXTURES.thesis}</p>
              </div>
              <CoordinatePair
                label={FIXTURES.rowLabel.toUpperCase()}
                value={FIXTURES.size}
                fullValue={FIXTURES.address}
              />
              <CoordinateGrid>
                <CoordinatePair label="ZERO" value="0.00" />
                <CoordinatePair label="HUGE" value={FIXTURES.huge} />
                <CoordinatePair
                  label="ETHOS"
                  value={FIXTURES.ethos.toLocaleString("en-US")}
                />
              </CoordinateGrid>
              <Inline gap="2">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="pass-label">
                    CHIP {i + 1}
                  </span>
                ))}
              </Inline>
              <span
                className="pass-coordinate-pair-value"
                style={{ wordBreak: "break-all" }}
              >
                {FIXTURES.address}
              </span>
            </Stack>
          </Row>
        </div>
      </ShellContent>
    </PageShell>
  );
}
