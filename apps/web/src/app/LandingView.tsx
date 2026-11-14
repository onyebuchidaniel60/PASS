import Link from "next/link";

import type { HomeActivityDto, HomeDto, HomeTraderDto } from "@pass/contracts";

import { ScrollReveal } from "@/components/ScrollReveal";
import { Avatar } from "@/components/wave3/identity";
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
  MetricCard,
  MetricCardRow,
  NumberedEyebrow,
  Sparkline,
  StepGrid,
  Surface,
  type StepSpec,
} from "@/components/reference";
import { formatRelative } from "@/lib/format";
import { INFO } from "@/lib/nav";
import { heroLines } from "@/lib/hero-copy";

export const EMPTY_HOME: HomeDto = {
  demoMode: false,
  topTraders: [],
  activity: [],
};

const LOOP = [
  { step: "01", label: "X post" },
  { step: "02", label: "Pass" },
  { step: "03", label: "trader context" },
  { step: "04", label: "trade plan" },
  { step: "05", label: "Hyperliquid" },
];

const STEPS: StepSpec[] = [
  {
    step: 1,
    title: "Discover",
    body: "Browse public Passes from traders who publish the plan before the trade.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Plans" value="Public" />
        <MetricCard label="Venue" value="HL" />
      </MetricCardRow>
    ),
    footLabel: "Discover",
  },
  {
    step: 2,
    title: "Understand",
    body: "Read the thesis, entry, target and invalidation. The whole plan is visible before you commit.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Entry" value="$113.4K" />
        <MetricCard label="Stop" value="$111.9K" />
      </MetricCardRow>
    ),
    footLabel: "Read",
  },
  {
    step: 3,
    title: "Size",
    body: "You choose your own size and leverage. PASS never chooses risk for you.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Your size" value="USDC" />
        <MetricCard label="Your call" value="1x+" />
      </MetricCardRow>
    ),
    footLabel: "Your risk",
  },
  {
    step: 4,
    title: "Execute",
    body: "Authorize with your own wallet. The fill lands in your account and the record is written against the plan version.",
    visual: (
      <MetricCardRow>
        <MetricCard label="Signer" value="You" />
        <MetricCard label="Custody" value="Self" />
      </MetricCardRow>
    ),
    footLabel: "Settle",
  },
];

type FeatureGlyphName = "key" | "eye" | "candles" | "chain";

const FEATURES: Array<{
  glyph: FeatureGlyphName;
  title: string;
  body: string;
  meta: string;
}> = [
  {
    glyph: "key",
    title: "Non-custodial",
    body: "Your keys stay in your wallet. PASS never holds funds, and the execution relay never receives a private key.",
    meta: "Your keys",
  },
  {
    glyph: "eye",
    title: "Transparent plans",
    body: "Entry, take profit, stop loss and thesis are published together. No hidden moves, no silent edits to a live plan.",
    meta: "No hidden moves",
  },
  {
    glyph: "candles",
    title: "Real trades on Hyperliquid",
    body: "Executions are signed orders on Hyperliquid, recorded against the exact Pass version the taker reviewed.",
    meta: "Mainnet execution",
  },
  {
    glyph: "chain",
    title: "NEAR Intents funding",
    body: "Fund a trading account from another chain without opening a second workflow. The quote names the deposit route.",
    meta: "Cross-chain",
  },
];

/**
 * The three guarantees the hero can make before a visitor opens a Pass.
 * They reuse the Why PASS glyphs rather than introducing a second icon set.
 */
const TRUST: Array<{ glyph: FeatureGlyphName; label: string }> = [
  { glyph: "candles", label: "Real Trades on Hyperliquid" },
  { glyph: "key", label: "Your Keys Always Yours" },
  { glyph: "eye", label: "Transparent Plans" },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  entry_pending: "Entry pending",
  open: "Open",
  tp_hit: "TP hit",
  sl_hit: "SL hit",
  manually_closed: "Closed",
  expired: "Expired",
  cancelled: "Cancelled",
  invalidated: "Invalidated",
  draft: "Draft",
};

function signedPct(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatUsd(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function signedUsd(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : "-"}${formatUsd(String(Math.abs(n)))}`;
}

function TraderCard({ trader, rank }: { trader: HomeTraderDto; rank: number }) {
  const pnlTone =
    trader.pnlPct === null
      ? "neutral"
      : trader.pnlPct >= 0
        ? "positive"
        : "negative";
  return (
    <article className="pass-trader-card">
      <div className="pass-trader-card-head">
        <Avatar src={trader.avatarUrl} handle={trader.handle ?? trader.displayName} />
        <div className="pass-trader-identity">
          <h3 className="pass-trader-name">{trader.displayName}</h3>
          <span className="pass-trader-handle">
            @{trader.handle ?? trader.slug}
          </span>
        </div>
        <span className="pass-trader-rank" aria-hidden="true">
          {String(rank).padStart(2, "0")}
        </span>
      </div>

      <dl className="pass-trader-stats">
        <div>
          <dt>Win rate</dt>
          <dd>
            {trader.winRatePct === null
              ? "—"
              : `${trader.winRatePct.toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt>PnL</dt>
          <dd data-tone={pnlTone}>{signedPct(trader.pnlPct)}</dd>
        </div>
      </dl>

      <div className="pass-trader-spark">
        <Sparkline
          points={trader.sparkline}
          tone={pnlTone === "negative" ? "negative" : "positive"}
          label={`${trader.displayName} cumulative realized PnL`}
        />
        <span className="pass-trader-pnl-usd">
          {signedUsd(trader.pnlUsd)} realized
        </span>
      </div>

      <div className="pass-trader-card-foot">
        <span>
          {trader.publishedPasses} Pass
          {trader.publishedPasses === 1 ? "" : "es"} ·{" "}
          {trader.completedExecutions} closed
        </span>
        <Link
          href={`/u/${trader.slug}`}
          className="pass-trader-card-link"
          aria-label={`View ${trader.displayName}'s profile`}
        >
          View Profile <span aria-hidden="true">{"\u2192"}</span>
        </Link>
      </div>
    </article>
  );
}

function ActivityRow({ activity }: { activity: HomeActivityDto }) {
  const handle = activity.actor.handle ?? activity.actor.slug;
  const meta = [
    STATUS_LABEL[activity.pass.status] ?? activity.pass.status,
    activity.sizeUsd ? `${formatUsd(activity.sizeUsd)} size` : null,
    activity.pnlUsd ? `${signedUsd(activity.pnlUsd)} realized` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="pass-activity-row">
      <time
        className="pass-activity-time"
        dateTime={activity.at}
        title={new Date(activity.at).toISOString()}
      >
        {formatRelative(activity.at)}
      </time>
      <span className="pass-activity-rail" aria-hidden="true">
        <span className="pass-activity-node" data-kind={activity.kind} />
      </span>
      <div className="pass-activity-copy">
        <p>
          <Link href={`/u/${activity.actor.slug}`} className="pass-activity-actor">
            @{handle}
          </Link>{" "}
          {activity.kind === "execution" ? "executed" : "published"}{" "}
          <Link
            href={`/p/${activity.pass.publicId}`}
            className="pass-activity-pass"
          >
            {activity.pass.asset} {activity.pass.direction.toUpperCase()}
          </Link>
        </p>
        <span className="pass-activity-meta">
          {activity.kind === "published" ? "New plan · " : ""}
          {meta}
        </span>
      </div>
      <Link
        href={`/p/${activity.pass.publicId}`}
        className="pass-activity-open"
        aria-label={`Open ${activity.pass.asset} ${activity.pass.direction} Pass`}
      >
        <span aria-hidden="true">{"\u2197"}</span>
      </Link>
    </li>
  );
}

function FeatureGlyph({ name }: { name: FeatureGlyphName }) {
  const common = {
    className: "pass-feature-glyph",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "key") {
    return (
      <svg {...common}>
        <circle cx="8" cy="12" r="3.5" />
        <path d="M11.5 12H21M18 12v3M15 12v2" />
      </svg>
    );
  }
  if (name === "eye") {
    return (
      <svg {...common}>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }
  if (name === "candles") {
    return (
      <svg {...common}>
        <path d="M6 3v18M18 3v18" />
        <rect x="3.5" y="7" width="5" height="8" />
        <rect x="15.5" y="5" width="5" height="6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.5 12 7-4.5M8.5 12l7 4.5" />
    </svg>
  );
}

export function LandingView({ home }: { home: HomeDto }) {
  const traders = home.topTraders;
  const activity = home.activity;

  return (
    <PageShell>
      <ShellContent className="pass-landing">
        <Surface strength="hero" watermark="PASS" className="pass-landing-shell">
          <div className="pass-landing-field">
            <GridField />
          </div>

          <CornerBracketFrame
            className="pass-landing-frame"
            labelledBy="landing-hero"
          >
            <div className="pass-landing-hero">
              <div className="pass-landing-stage">
                <div
                  className="pass-landing-live"
                  role="status"
                  aria-label="Hyperliquid Mainnet is live"
                >
                  <span className="pass-landing-live-dot" aria-hidden="true" />
                  <span>Hyperliquid Mainnet is Live</span>
                </div>

                <DisplayHeadline lines={heroLines("landing")} />
                <p className="pass-landing-lede" id="landing-hero">
                  A trader publishes a Hyperliquid perps or prediction-market
                  plan. You read it, size it yourself, and authorize it with
                  your own wallet. Nothing is copied and no key ever leaves your
                  browser.
                </p>

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

                <ul className="pass-landing-trust" aria-label="PASS guarantees">
                  {TRUST.map((item) => (
                    <li key={item.label} className="pass-landing-trust-item">
                      <span className="pass-landing-trust-icon">
                        <FeatureGlyph name={item.glyph} />
                      </span>
                      <span className="pass-landing-trust-label">
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <aside
                className="pass-landing-phone"
                aria-label="Animated preview of the PASS mobile flow: discover on X, take a BTC Long, execution confirmed on Hyperliquid Mainnet"
              >
                <div className="pass-phone" aria-hidden="true">
                  <div className="pass-phone-notch" />
                  <div className="pass-phone-screen">
                    <div className="pass-phone-statusbar">
                      <span>9:41</span>
                      <span className="pass-phone-status-icons">
                        <span>5G</span>
                        <span className="pass-phone-battery" />
                      </span>
                    </div>
                    <div className="pass-phone-states">
                      <div className="pass-phone-state" data-state="discover">
                        <span className="pass-phone-eyebrow">On X</span>
                        <div className="pass-phone-x-post">
                          <div className="pass-phone-x-head">
                            <span className="pass-phone-avatar">T</span>
                            <span className="pass-phone-x-name">
                              <strong>@traderx</strong>
                              <small>· now</small>
                            </span>
                          </div>
                          <p className="pass-phone-x-copy">
                            Just published a BTC Long on{" "}
                            <span>@PASS</span>
                          </p>
                          <div className="pass-phone-x-plan">
                            <span>BTC LONG</span>
                            <span>5x</span>
                          </div>
                          <span className="pass-phone-link">
                            View Pass <span aria-hidden="true">{"\u2192"}</span>
                          </span>
                        </div>
                      </div>

                      <div className="pass-phone-state" data-state="take">
                        <span className="pass-phone-eyebrow">Take the Pass</span>
                        <div className="pass-phone-asset">
                          BTC <span>LONG</span>
                        </div>
                        <div className="pass-phone-levels">
                          <div>
                            <span>Entry</span>
                            <strong>$113.4K</strong>
                          </div>
                          <div>
                            <span>Stop</span>
                            <strong>$111.9K</strong>
                          </div>
                          <div>
                            <span>Target</span>
                            <strong>$116.0K</strong>
                          </div>
                        </div>
                        <div className="pass-phone-size">
                          <span>Position size</span>
                          <strong>$50</strong>
                        </div>
                        <span className="pass-phone-action">
                          Authorize Trade
                        </span>
                      </div>

                      <div className="pass-phone-state" data-state="success">
                        <span className="pass-phone-check" aria-hidden="true">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m5 12 4 4 9-9" />
                          </svg>
                        </span>
                        <div className="pass-phone-success">
                          <strong>Execution Confirmed.</strong>
                          <span>Filled on Hyperliquid Mainnet.</span>
                        </div>
                        <div className="pass-phone-receipt">
                          <div>
                            <span>Plan</span>
                            <strong>BTC LONG</strong>
                          </div>
                          <div>
                            <span>Size</span>
                            <strong>$50</strong>
                          </div>
                          <div>
                            <span>Trader</span>
                            <strong>@traderx</strong>
                          </div>
                        </div>
                        <span className="pass-phone-link">
                          View receipt <span aria-hidden="true">{"\u2192"}</span>
                        </span>
                      </div>
                    </div>
                    <div className="pass-phone-homebar" />
                  </div>
                </div>
              </aside>

              <SignalLine
                reveal
                node={<Reticle label="Signal line origin" />}
              />
            </div>
          </CornerBracketFrame>

          <div className="pass-landing-loop">
            <p className="pass-landing-loop-label">The loop</p>
            <ol className="pass-loop-strip">
              {LOOP.map((step) => (
                <li key={step.step} className="pass-loop-step">
                  <CoordinatePair label={step.step} value={step.label} />
                </li>
              ))}
            </ol>
          </div>
        </Surface>

        <ScrollReveal>
          <Section label="Top traders" className="pass-landing-traders">
            <Stack gap="5">
              <div className="pass-landing-section-head">
                <div>
                  <NumberedEyebrow label="Top traders" number={1} />
                  <DisplayHeadline
                    section
                    as="h2"
                    lines={[
                      [{ text: "The" }, { text: "traders" }],
                      [{ text: "worth" }, { text: "following.", accent: true }],
                    ]}
                  />
                </div>
                <Link href="/discover" className="pass-landing-view-all">
                  View All <span aria-hidden="true">{"\u2192"}</span>
                </Link>
              </div>

              <div className="pass-trader-grid">
                {traders.map((trader, index) => (
                  <TraderCard
                    key={trader.slug}
                    trader={trader}
                    rank={index + 1}
                  />
                ))}
                <Link href="/passes/new" className="pass-trader-cta-card">
                  <span className="pass-trader-cta-mark" aria-hidden="true">
                    +
                  </span>
                  <span className="pass-trader-cta-eyebrow">Be a Trader</span>
                  <span className="pass-trader-cta-title">
                    Publish the plan.
                    <br />
                    Build the record.
                  </span>
                  <span className="pass-trader-cta-body">
                    Your thesis, your levels, your terms. The market decides the
                    rest.
                  </span>
                  <span className="pass-trader-cta-action">
                    Create a Pass <span aria-hidden="true">{"\u2192"}</span>
                  </span>
                </Link>
              </div>
              {traders.length === 0 ? (
                <p className="pass-landing-empty">
                  No public trader record yet. The first Pass starts it.
                </p>
              ) : null}
            </Stack>
          </Section>
        </ScrollReveal>

        <ScrollReveal>
          <Section label="Live activity" className="pass-landing-activity">
            <Stack gap="5">
              <div className="pass-landing-section-head">
                <div>
                  <NumberedEyebrow label="Live activity" number={2} />
                  <DisplayHeadline
                    section
                    as="h2"
                    lines={[
                      [{ text: "The" }, { text: "tape," }],
                      [{ text: "as" }, { text: "it" }, { text: "happens.", accent: true }],
                    ]}
                  />
                </div>
                <span
                  className="pass-activity-live"
                  role="status"
                  aria-label="Live activity feed"
                >
                  <span className="pass-activity-live-dot" aria-hidden="true" />
                  <span>Live</span>
                </span>
              </div>

              <div className="pass-activity-ledger">
                <div className="pass-activity-ledger-head">
                  <span>Recent executions</span>
                  <span>{activity.length} latest</span>
                </div>
                {activity.length === 0 ? (
                  <p className="pass-landing-empty">
                    No public activity yet. The first plan is one click away.
                  </p>
                ) : (
                  <ol className="pass-activity-list">
                    {activity.map((row) => (
                      <ActivityRow key={row.id} activity={row} />
                    ))}
                  </ol>
                )}
              </div>
            </Stack>
          </Section>
        </ScrollReveal>

        <ScrollReveal>
          <Section label="How it works" className="pass-landing-how">
            <Stack gap="5">
              <NumberedEyebrow label="How it works" number={3} />
              <DisplayHeadline
                section
                as="h2"
                lines={heroLines("howItWorks")}
              />
              <p className="pass-landing-lede">
                A Pass is a plan with a public record. Read it, size it, sign
                it. Four steps, no hand-offs.
              </p>
              <CornerBracketFrame labelledBy="landing-steps">
                <h3 className="visually-hidden" id="landing-steps">
                  The four steps of a Pass
                </h3>
                <StepGrid steps={STEPS} />
              </CornerBracketFrame>
            </Stack>
          </Section>
        </ScrollReveal>

        <ScrollReveal>
          <Section label="Why PASS" className="pass-landing-why">
            <Stack gap="5">
              <NumberedEyebrow label="Why PASS" number={4} />
              <DisplayHeadline
                section
                as="h2"
                lines={[
                  [{ text: "Built" }, { text: "for" }],
                  [{ text: "your" }, { text: "own" }, { text: "hands.", accent: true }],
                ]}
              />
              <div className="pass-feature-grid">
                {FEATURES.map((feature) => (
                  <article className="pass-feature-card" key={feature.title}>
                    <span className="pass-feature-icon">
                      <FeatureGlyph name={feature.glyph} />
                    </span>
                    <h3 className="pass-feature-title">{feature.title}</h3>
                    <p className="pass-feature-body">{feature.body}</p>
                    <span className="pass-feature-meta">{feature.meta}</span>
                  </article>
                ))}
              </div>
            </Stack>
          </Section>
        </ScrollReveal>

        <ScrollReveal>
          <Section
            label="Security and Agent Economy"
            className="pass-landing-security"
          >
            <Stack gap="5">
              <NumberedEyebrow
                label="Security & agent economy"
                number={5}
              />
              <div className="pass-security-grid">
                <div className="pass-security-lead">
                  <DisplayHeadline
                    section
                    as="h2"
                    lines={[
                      [{ text: "Your" }, { text: "keys." }],
                      [{ text: "Your" }, { text: "funds.", accent: true }],
                    ]}
                  />
                  <p className="pass-landing-lede">
                    PASS is an execution layer, not a custodian. The wallet that
                    holds the funds is the wallet that signs the order.
                  </p>
                  <dl className="pass-security-ledger">
                    <div>
                      <dt>Keys</dt>
                      <dd>Never leave your browser</dd>
                    </div>
                    <div>
                      <dt>Funds</dt>
                      <dd>Stay in your own account</dd>
                    </div>
                    <div>
                      <dt>Agent key</dt>
                      <dd>Can place and cancel orders</dd>
                    </div>
                    <div>
                      <dt>Withdrawals</dt>
                      <dd>Never delegated to PASS</dd>
                    </div>
                  </dl>
                </div>

                <div className="pass-agent-panel">
                  <span className="pass-agent-eyebrow">Agent economy</span>
                  <h3 className="pass-agent-title">
                    Build on the execution layer.
                  </h3>
                  <p className="pass-agent-body">
                    The Agent API lets a builder prepare and relay orders within
                    the permissions the trader approved. It is a scoped signer,
                    not a bank account.
                  </p>
                  <ul className="pass-agent-list">
                    <li>Scoped execution access</li>
                    <li>No withdrawal authority</li>
                    <li>Revocable from Settings</li>
                  </ul>
                  <Link
                    href="/settings?tab=developers"
                    className="pass-agent-link"
                  >
                    Open Developer settings{" "}
                    <span aria-hidden="true">{"\u2192"}</span>
                  </Link>
                </div>
              </div>
            </Stack>
          </Section>
        </ScrollReveal>

        <ScrollReveal>
          <Section label="Get started" className="pass-landing-final">
            <Surface strength="section" className="pass-final-cta">
              <Stack gap="5">
                <NumberedEyebrow label="Get started" number={6} />
                <DisplayHeadline
                  section
                  as="h2"
                  lines={[
                    [{ text: "Ready" }, { text: "to" }, { text: "trade" }],
                    [{ text: "like" }, { text: "a" }, { text: "pro?", accent: true }],
                  ]}
                />
                <p className="pass-final-cta-lede">
                  Follow a plan you understand, or publish one you are willing
                  to defend. The record starts with the first Pass.
                </p>
                <Inline gap="3" className="pass-final-cta-actions">
                  <Link href="/discover" className="pass-final-cta-primary">
                    Explore Traders <span aria-hidden="true">{"\u2192"}</span>
                  </Link>
                  <Link href="/passes/new" className="pass-final-cta-secondary">
                    Create a Pass
                  </Link>
                </Inline>
                <ChipBar className="pass-final-cta-links">
                  {INFO.map((item) => (
                    <ChipButton key={item.href} href={item.href}>
                      {item.label}
                    </ChipButton>
                  ))}
                </ChipBar>
              </Stack>
            </Surface>
          </Section>
        </ScrollReveal>
      </ShellContent>
    </PageShell>
  );
}
