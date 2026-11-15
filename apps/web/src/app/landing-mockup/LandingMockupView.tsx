import Link from "next/link";
import type { ReactNode } from "react";

import {
  CornerBracketFrame,
  DisplayHeadline,
  NumberedEyebrow,
  Surface,
} from "@/components/reference";
import { Logo, LogoMark } from "@/components/reference/logo";
import { GridField } from "@/components/wave1/layout";
import { Reticle, SignalLine } from "@/components/wave1/signature";
import type { HeadlineWord } from "@/lib/hero-copy";
import { heroLines } from "@/lib/hero-copy";

import styles from "./landing-mockup.module.css";

const GITHUB_URL = "https://github.com/onyebuchidaniel60/PASS";

const PROBLEM_LINES: HeadlineWord[][] = [
  [{ text: "Alpha" }, { text: "is" }, { text: "social." }],
  [{ text: "Execution" }, { text: "is" }, { text: "not.", accent: true }],
];

const SOLUTION_LINES: HeadlineWord[][] = [
  [{ text: "One" }, { text: "layer." }],
  [{ text: "Zero" }, { text: "hand-offs.", accent: true }],
];

const HOW_LINES: HeadlineWord[][] = [
  [{ text: "Three" }, { text: "moves." }],
  [{ text: "No" }, { text: "detours.", accent: true }],
];

const FEATURE_LINES: HeadlineWord[][] = [
  [{ text: "Built" }, { text: "like" }],
  [{ text: "infrastructure." }],
  [{ text: "Not" }, { text: "a" }, { text: "group" }, { text: "chat.", accent: true }],
];

const CTA_LINES: HeadlineWord[][] = [
  [{ text: "The" }, { text: "trade" }, { text: "is" }],
  [{ text: "one" }, { text: "link" }, { text: "away.", accent: true }],
];

const FLOW = [
  { index: "01", label: "X post", meta: "The signal" },
  { index: "02", label: "PASS link", meta: "The plan" },
  { index: "03", label: "NEAR intent", meta: "The funding" },
  { index: "04", label: "Your signature", meta: "The authority" },
  { index: "05", label: "HL fill", meta: "The position" },
];

const PROBLEMS = [
  {
    index: "01",
    meta: "Liquidity",
    title: "Fragmented liquidity",
    body: "The call lives on X. The funds live on five chains. By the time the two meet, the setup has already moved.",
  },
  {
    index: "02",
    meta: "Custody",
    title: "Custodial bots",
    body: "Following a trade should not mean handing a bot your keys, your balance, and permission to withdraw both.",
  },
  {
    index: "03",
    meta: "Order flow",
    title: "MEV front-running",
    body: "A public mempool reads your order before the venue does. You get the fill everyone else already priced.",
  },
];

const LEAK_ROWS = [
  { name: "X post", state: "Signal", tone: "signal" },
  { name: "Bridge", state: "4-18 min", tone: "warning" },
  { name: "Bot", state: "Custody", tone: "warning" },
  { name: "Mempool", state: "Front-run", tone: "warning" },
  { name: "Fill", state: "Priced in", tone: "muted" },
];

const SOLUTIONS = [
  {
    index: "01",
    meta: "Cross-chain funding",
    title: "NEAR Intents",
    body: "Fund a position from any supported chain with one intent. The quote names the route. There is no bridge detour and no wrapped-asset detour.",
  },
  {
    index: "02",
    meta: "Privacy",
    title: "Confidential Intents",
    body: "Your size and your route stay out of the public eye. Execution is shielded before it reaches the order book, so your edge is not a public good.",
  },
  {
    index: "03",
    meta: "Execution",
    title: "Non-custodial wallet execution",
    body: "PASS prepares the order. Your wallet signs it. Hyperliquid settles it. No private key and no withdrawal permission ever leaves your device.",
  },
];

function FeatureGlyph({ name }: { name: "key" | "signal" | "terminal" | "candles" }) {
  const common = {
    className: styles.featureGlyph,
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

  if (name === "signal") {
    return (
      <svg {...common}>
        <path d="M4 20v-4M9.3 20V12M14.7 20V8M20 20V4" />
        <path d="M3 11c4.2-4.7 9.6-7.2 16-7" />
        <path d="m16 3 3 1-1 3" />
      </svg>
    );
  }

  if (name === "terminal") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" />
        <path d="m7 9 3 3-3 3M13 15h4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M6 3v18M18 3v18" />
      <rect x="3.5" y="7" width="5" height="8" />
      <rect x="15.5" y="5" width="5" height="6" />
    </svg>
  );
}

function StepVisualFrame({
  label,
  state,
  children,
}: {
  label: string;
  state: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.stepVisual}>
      <div className={styles.stepVisualHead}>
        <span className={styles.stepVisualLabel}>{label}</span>
        <span className={styles.stepVisualState}>{state}</span>
      </div>
      {children}
    </div>
  );
}

export function LandingMockupView() {
  return (
    <div className={styles.page} data-landing-mockup>
      <div className={styles.announcement}>
        <div className={styles.announcementInner}>
          <span className={styles.announcementLead}>
            <span className={styles.announcementDot} aria-hidden="true" />
            Live on Hyperliquid Mainnet
          </span>
          <span className={styles.announcementMeta}>
            Fund from any chain &middot; Sign from your wallet
          </span>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="PASS home">
            <LogoMark size={26} />
            <Logo size={26} title={null} className={styles.brandWordmark} />
            <span className={styles.brandRule} aria-hidden="true" />
            <span className={styles.brandMeta}>Social execution</span>
          </Link>

          <nav className={styles.nav} aria-label="Landing sections">
            <a href="#problem" className={styles.navLink}>
              The problem
            </a>
            <a href="#solution" className={styles.navLink}>
              The solution
            </a>
            <a href="#how-it-works" className={styles.navLink}>
              How it works
            </a>
            <a href="#features" className={styles.navLink}>
              Features
            </a>
          </nav>

          <div className={styles.headerActions}>
            <span className={styles.headerStatus}>NEAR Intents</span>
            <Link
              href="/"
              className={`pass-btn ${styles.headerCta}`}
              data-variant="secondary"
              data-size="sm"
            >
              Launch App
            </Link>
          </div>
        </div>

        <nav className={styles.mobileNav} aria-label="Landing sections">
          <a href="#problem" className={styles.mobileNavLink}>
            Problem
          </a>
          <a href="#solution" className={styles.mobileNavLink}>
            Solution
          </a>
          <a href="#how-it-works" className={styles.mobileNavLink}>
            How it works
          </a>
          <a href="#features" className={styles.mobileNavLink}>
            Features
          </a>
        </nav>
      </header>

      <main>
        <Surface strength="hero" watermark="PASS" className={styles.hero}>
          <div className={styles.heroField}>
            <GridField />
          </div>

          <div className={styles.heroInner}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <div className={styles.heroEyebrow}>
                  <span className={styles.heroEyebrowIndex}>00</span>
                  <span className={styles.heroEyebrowRule} aria-hidden="true" />
                  <span className={styles.heroEyebrowLabel}>
                    The social execution layer
                  </span>
                  <span className={styles.heroEyebrowMeta}>
                    NEAR Intents &times; Hyperliquid
                  </span>
                </div>

                <DisplayHeadline
                  lines={heroLines("landing")}
                  className={styles.heroTitle}
                />

                <p className={styles.heroLede}>
                  The chain-agnostic social execution layer built on NEAR Intents.
                  Read the plan, fund from any chain, and execute on Hyperliquid
                  with your keys, your size, your call.
                </p>

                <div className={styles.heroActions}>
                  <Link
                    href="/"
                    className={`pass-btn ${styles.primaryCta}`}
                    data-variant="primary"
                    data-size="lg"
                  >
                    Launch App
                    <span className={styles.ctaArrow} aria-hidden="true">
                      {"\u2197"}
                    </span>
                  </Link>
                  <a href="#how-it-works" className={styles.secondaryCta}>
                    See how it works
                    <span aria-hidden="true">{"\u2192"}</span>
                  </a>
                </div>

                <ul className={styles.trustRow} aria-label="PASS guarantees">
                  <li className={styles.trustItem}>Non-custodial</li>
                  <li className={styles.trustItem}>NEAR Intents</li>
                  <li className={styles.trustItem}>Confidential Intents</li>
                  <li className={styles.trustItem}>Hyperliquid</li>
                </ul>
              </div>

              <aside
                className={styles.heroStage}
                aria-label="Example PASS trade plan"
              >
                <CornerBracketFrame className={styles.stageFrame}>
                  <div className={styles.stageHead}>
                    <span className={styles.stageLabel}>Specimen plan</span>
                    <span className={styles.stageLive}>
                      <span className={styles.liveSquare} aria-hidden="true" />
                      Mainnet
                    </span>
                  </div>

                  <div className={styles.stageAssetRow}>
                    <p className={styles.stageAsset}>
                      BTC <span className={styles.stageDirection}>LONG</span>
                    </p>
                    <span className={styles.stageLeverage}>3&times;</span>
                  </div>

                  <p className={styles.stageThesis}>
                    Higher low held. Funding neutral. Targeting the range high
                    before CPI.
                  </p>

                  <dl className={styles.stageMetrics}>
                    <div className={styles.stageMetric}>
                      <dt>Entry</dt>
                      <dd>$113,420</dd>
                    </div>
                    <div className={styles.stageMetric}>
                      <dt>Target</dt>
                      <dd>$118,900</dd>
                    </div>
                    <div className={styles.stageMetric}>
                      <dt>Stop</dt>
                      <dd>$111,150</dd>
                    </div>
                  </dl>

                  <div className={styles.stageTrader}>
                    <span className={styles.avatar} aria-hidden="true">
                      T
                    </span>
                    <span className={styles.traderIdentity}>
                      <span className={styles.traderHandle}>@turnttfup99</span>
                      <span className={styles.traderMeta}>
                        38 Passes &middot; 72.4% win rate
                      </span>
                    </span>
                    <span className={styles.stageVerified}>Verified</span>
                  </div>

                  <div className={styles.stageRoute}>
                    <span className={styles.stageRouteLabel}>Funding</span>
                    <span className={styles.stageRoutePath}>
                      USDC / Base <span aria-hidden="true">{"\u2192"}</span> NEAR{" "}
                      <span aria-hidden="true">{"\u2192"}</span> Hyperliquid
                    </span>
                  </div>

                  <div className={styles.stageCta}>
                    <span>Take this trade</span>
                    <span aria-hidden="true">{"\u2197"}</span>
                  </div>
                </CornerBracketFrame>

                <div className={styles.stageAside}>
                  <span>Key stays in your wallet</span>
                  <span>Intent quoted</span>
                </div>
              </aside>
            </div>

            <SignalLine
              reveal
              node={<Reticle label="Signal line origin" />}
              className={styles.heroSignal}
            />

            <ol className={styles.flowRail} aria-label="The PASS execution loop">
              {FLOW.map((step, index) => (
                <li className={styles.flowStep} key={step.index}>
                  <div className={styles.flowStepTop}>
                    <span className={styles.flowStepIndex}>{step.index}</span>
                    {index < FLOW.length - 1 ? (
                      <span className={styles.flowStepArrow} aria-hidden="true">
                        {"\u2192"}
                      </span>
                    ) : null}
                  </div>
                  <span className={styles.flowStepLabel}>{step.label}</span>
                  <span className={styles.flowStepMeta}>{step.meta}</span>
                </li>
              ))}
            </ol>
          </div>
        </Surface>

        <section
          id="problem"
          className={styles.section}
          aria-label="The problem"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHead}>
              <NumberedEyebrow label="The problem" number={1} />
              <div className={styles.sectionTitleRow}>
                <DisplayHeadline
                  section
                  as="h2"
                  lines={PROBLEM_LINES}
                  className={styles.sectionTitle}
                />
                <p className={styles.sectionLede}>
                  Crypto Twitter is the discovery layer. Everything after the post
                  is a chain of custody, bridges, bots, and blind signatures. The
                  edge leaks at every hand-off.
                </p>
              </div>
            </div>

            <div className={styles.problemGrid}>
              <div className={styles.breakdown} aria-label="Where execution leaks">
                <div className={styles.breakdownHead}>
                  <span className={styles.breakdownLabel}>The leak</span>
                  <span className={styles.breakdownCount}>5 hand-offs</span>
                </div>
                <div className={styles.breakdownRows}>
                  {LEAK_ROWS.map((row) => (
                    <div className={styles.breakdownRow} key={row.name}>
                      <span className={styles.breakdownNode} aria-hidden="true" />
                      <span className={styles.breakdownName}>{row.name}</span>
                      <span
                        className={styles.breakdownState}
                        data-tone={row.tone}
                      >
                        {row.state}
                      </span>
                    </div>
                  ))}
                </div>
                <p className={styles.breakdownNote}>
                  Every hand-off is another chance to lose the edge.
                </p>
              </div>

              <ol className={styles.problemList}>
                {PROBLEMS.map((problem) => (
                  <li className={styles.problemItem} key={problem.index}>
                    <span className={styles.problemIndex}>{problem.index}</span>
                    <div className={styles.problemContent}>
                      <span className={styles.problemMeta}>{problem.meta}</span>
                      <h3 className={styles.problemTitle}>{problem.title}</h3>
                      <p className={styles.problemBody}>{problem.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className={styles.manifesto} aria-label="PASS principles">
              <div className={styles.manifestoInner}>
                <span className={styles.manifestoItem}>No bridge.</span>
                <span className={styles.manifestoItem}>No bot.</span>
                <span className={styles.manifestoItem}>
                  No custodian.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          id="solution"
          className={styles.section}
          aria-label="The solution"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHead}>
              <NumberedEyebrow label="The solution" number={2} />
              <div className={styles.sectionTitleRow}>
                <DisplayHeadline
                  section
                  as="h2"
                  lines={SOLUTION_LINES}
                  className={styles.sectionTitle}
                />
                <p className={styles.sectionLede}>
                  PASS composes NEAR Intents, Confidential Intents, and your own
                  wallet into one execution path. The alpha stays social. The
                  execution stays yours.
                </p>
              </div>
            </div>

            <div className={styles.solutionGrid}>
              <div className={styles.solutionCards}>
                {SOLUTIONS.map((solution) => (
                  <article className={styles.solutionCard} key={solution.index}>
                    <span className={styles.solutionIndex}>{solution.index}</span>
                    <div className={styles.solutionContent}>
                      <span className={styles.solutionMeta}>{solution.meta}</span>
                      <h3 className={styles.solutionTitle}>{solution.title}</h3>
                      <p className={styles.solutionBody}>{solution.body}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.routePanel} aria-label="Example funding route">
                <div className={styles.routeHead}>
                  <span className={styles.routeLabel}>Intent route</span>
                  <span className={styles.routeStatus}>Preview</span>
                </div>
                <div className={styles.routeLine}>
                  <span className={styles.routeKey}>Source</span>
                  <span className={styles.routeValue}>USDC / Base</span>
                </div>
                <div className={styles.routeLine}>
                  <span className={styles.routeKey}>Intent</span>
                  <span className={styles.routeValue}>NEAR Intents</span>
                </div>
                <div className={styles.routeLine}>
                  <span className={styles.routeKey}>Privacy</span>
                  <span className={styles.routeValue}>Confidential</span>
                </div>
                <div className={styles.routeLine}>
                  <span className={styles.routeKey}>Destination</span>
                  <span className={styles.routeValue}>Hyperliquid</span>
                </div>
                <div className={styles.routeLine}>
                  <span className={styles.routeKey}>Signer</span>
                  <span className={styles.routeValue}>Your wallet</span>
                </div>
                <div className={styles.routeFoot}>
                  <span className={styles.routeDot} aria-hidden="true" />
                  Non-custodial end to end
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className={styles.section}
          aria-label="How it works"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHead}>
              <NumberedEyebrow label="How it works" number={3} />
              <div className={styles.sectionTitleRow}>
                <DisplayHeadline
                  section
                  as="h2"
                  lines={HOW_LINES}
                  className={styles.sectionTitle}
                />
                <p className={styles.sectionLede}>
                  A trade plan becomes a position in three moves. You never leave
                  the plan to find liquidity, and you never hand over custody to
                  find execution.
                </p>
              </div>
            </div>

            <div className={styles.stepGrid}>
              <article className={styles.stepCard}>
                <div className={styles.stepTop}>
                  <span className={styles.stepIndex}>01</span>
                  <span className={styles.stepArrow} aria-hidden="true">
                    {"\u2192"}
                  </span>
                </div>
                <h3 className={styles.stepTitle}>Discover</h3>
                <p className={styles.stepBody}>
                  Open a plan from X or the feed. Read the thesis, entry, target,
                  and invalidation before you commit a dollar.
                </p>
                <StepVisualFrame label="X / post" state="2m ago">
                  <div className={styles.stepPostHead}>
                    <span className={styles.stepAvatar} aria-hidden="true">
                      T
                    </span>
                    <span className={styles.stepPostIdentity}>
                      <strong className={styles.stepPostName}>@turnttfup99</strong>
                      <span className={styles.stepPostMeta}>Published a Pass</span>
                    </span>
                  </div>
                  <p className={styles.stepPostCopy}>
                    BTC long. Higher low held. Target $118,900.
                  </p>
                  <div className={styles.stepPostLink}>
                    <span>/p/BTC-7F2A</span>
                    <span aria-hidden="true">{"\u2197"}</span>
                  </div>
                </StepVisualFrame>
                <div className={styles.stepFoot}>
                  <span className={styles.stepFootLabel}>01 / Signal</span>
                  <span className={styles.stepFootAction}>Read the plan</span>
                </div>
              </article>

              <article className={styles.stepCard}>
                <div className={styles.stepTop}>
                  <span className={styles.stepIndex}>02</span>
                  <span className={styles.stepArrow} aria-hidden="true">
                    {"\u2192"}
                  </span>
                </div>
                <h3 className={styles.stepTitle}>Fund via NEAR</h3>
                <p className={styles.stepBody}>
                  Choose your own size. One NEAR Intent quotes the cross-chain
                  route and lands USDC in your Hyperliquid account.
                </p>
                <StepVisualFrame label="Intent / quote" state="Confidential">
                  <div className={styles.stepRouteRow}>
                    <span className={styles.stepRouteKey}>From</span>
                    <span className={styles.stepRouteValue}>USDC / Base</span>
                  </div>
                  <div className={styles.stepRouteRow}>
                    <span className={styles.stepRouteKey}>Via</span>
                    <span className={styles.stepRouteValue}>NEAR Intents</span>
                  </div>
                  <div className={styles.stepRouteRow}>
                    <span className={styles.stepRouteKey}>To</span>
                    <span className={styles.stepRouteValue}>Hyperliquid</span>
                  </div>
                  <div className={styles.stepRouteBar} aria-hidden="true">
                    <span className={styles.stepRouteTrack} />
                  </div>
                </StepVisualFrame>
                <div className={styles.stepFoot}>
                  <span className={styles.stepFootLabel}>02 / Funding</span>
                  <span className={styles.stepFootAction}>Approve the route</span>
                </div>
              </article>

              <article className={styles.stepCard}>
                <div className={styles.stepTop}>
                  <span className={styles.stepIndex}>03</span>
                  <span className={styles.stepArrow} aria-hidden="true">
                    {"\u2713"}
                  </span>
                </div>
                <h3 className={styles.stepTitle}>Execute</h3>
                <p className={styles.stepBody}>
                  Sign the order from your wallet. The fill lands in your
                  account, recorded against the plan version you actually read.
                </p>
                <StepVisualFrame label="Order / ticket" state="Ready">
                  <div className={styles.stepOrderAsset}>
                    BTC <span>LONG</span>
                  </div>
                  <div className={styles.stepRouteRow}>
                    <span className={styles.stepRouteKey}>Size</span>
                    <span className={styles.stepRouteValue}>$2,500</span>
                  </div>
                  <div className={styles.stepRouteRow}>
                    <span className={styles.stepRouteKey}>Signer</span>
                    <span className={styles.stepRouteValue}>Your wallet</span>
                  </div>
                  <div className={styles.stepRouteRow}>
                    <span className={styles.stepRouteKey}>Venue</span>
                    <span className={styles.stepRouteValue}>Hyperliquid</span>
                  </div>
                </StepVisualFrame>
                <div className={styles.stepFoot}>
                  <span className={styles.stepFootLabel}>03 / Settlement</span>
                  <span className={styles.stepFootAction}>Own the fill</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          id="features"
          className={styles.section}
          aria-label="Features"
        >
          <div className={styles.sectionInner}>
            <div className={styles.sectionHead}>
              <NumberedEyebrow label="Features" number={4} />
              <div className={styles.sectionTitleRow}>
                <DisplayHeadline
                  section
                  as="h2"
                  lines={FEATURE_LINES}
                  className={styles.sectionTitle}
                />
                <p className={styles.sectionLede}>
                  Four load-bearing pieces. No account-abstraction theatre, no
                  hidden custody, no rented liquidity.
                </p>
              </div>
            </div>

            <div className={styles.featureGrid}>
              <article className={styles.featureCard}>
                <div className={styles.featureTop}>
                  <span className={styles.featureIcon}>
                    <FeatureGlyph name="key" />
                  </span>
                  <span className={styles.featureIndex}>01</span>
                </div>
                <h3 className={styles.featureTitle}>Non-Custodial</h3>
                <p className={styles.featureBody}>
                  Your keys never leave your wallet. Every order is signed by
                  you, and PASS never holds funds at any point.
                </p>
                <span className={styles.featureMeta}>Keys / yours</span>
              </article>

              <article className={styles.featureCard}>
                <div className={styles.featureTop}>
                  <span className={styles.featureIcon}>
                    <FeatureGlyph name="signal" />
                  </span>
                  <span className={styles.featureIndex}>02</span>
                </div>
                <h3 className={styles.featureTitle}>Social Execution</h3>
                <p className={styles.featureBody}>
                  Every public post can become a versioned, tradeable plan. The
                  link is the interface, and the record stays public.
                </p>
                <span className={styles.featureMeta}>Post / trade</span>
              </article>

              <article className={styles.featureCard}>
                <div className={styles.featureTop}>
                  <span className={styles.featureIcon}>
                    <FeatureGlyph name="terminal" />
                  </span>
                  <span className={styles.featureIndex}>03</span>
                </div>
                <h3 className={styles.featureTitle}>Agent API</h3>
                <p className={styles.featureBody}>
                  Let agents and builders prepare orders inside scoped
                  permissions. Read-only by default, revocable at any time.
                </p>
                <span className={styles.featureMeta}>Scoped / revocable</span>
              </article>

              <article className={styles.featureCard}>
                <div className={styles.featureTop}>
                  <span className={styles.featureIcon}>
                    <FeatureGlyph name="candles" />
                  </span>
                  <span className={styles.featureIndex}>04</span>
                </div>
                <h3 className={styles.featureTitle}>Hyperliquid Execution</h3>
                <p className={styles.featureBody}>
                  Client-signed orders land on Hyperliquid Mainnet. The fill is
                  the receipt, and the plan version is the record.
                </p>
                <span className={styles.featureMeta}>Mainnet / signed</span>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.cta} aria-label="Get started">
          <Surface strength="section" watermark="PASS" className={styles.ctaSurface}>
            <div className={styles.ctaInner}>
              <NumberedEyebrow label="Get started" number={5} />
              <DisplayHeadline
                section
                as="h2"
                lines={CTA_LINES}
                className={styles.ctaTitle}
              />
              <div className={styles.ctaRow}>
                <p className={styles.ctaLede}>
                  Read the plan. Fund the intent. Sign the order. Your keys stay
                  yours from the first post to the final fill.
                </p>
                <div className={styles.ctaActions}>
                  <Link
                    href="/"
                    className={`pass-btn ${styles.primaryCta}`}
                    data-variant="primary"
                    data-size="lg"
                  >
                    Launch App
                    <span className={styles.ctaArrow} aria-hidden="true">
                      {"\u2197"}
                    </span>
                  </Link>
                  <Link href="/docs" className={styles.ctaSecondary}>
                    Read the docs
                    <span aria-hidden="true">{"\u2192"}</span>
                  </Link>
                </div>
              </div>
              <p className={styles.ctaFootnote}>
                No bridge. No bot. No custodian. Just a plan you can read and a
                position you can sign.
              </p>
            </div>
          </Surface>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link href="/" className={styles.brand} aria-label="PASS home">
                <LogoMark size={26} />
                <Logo size={26} title={null} className={styles.brandWordmark} />
              </Link>
              <p className={styles.footerTagline}>
                Social execution for Hyperliquid.
                <br />
                Powered by NEAR Intents.
              </p>
            </div>

            <nav className={styles.footerLinks} aria-label="Footer">
              <Link href="/docs" className={styles.footerLink}>
                Docs
              </Link>
              <a
                href={GITHUB_URL}
                className={styles.footerLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
                <span aria-hidden="true">{"\u2197"}</span>
              </a>
              <Link href="/terms" className={styles.footerLink}>
                Terms
              </Link>
            </nav>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerNote}>
              PASS is a social execution layer for Hyperliquid. You authorize
              your own orders with your own position size.
            </p>
            <p className={styles.footerMeta}>
              &copy; 2026 PASS <span aria-hidden="true">/</span> Built on NEAR
              Intents <span aria-hidden="true">/</span> Executed on Hyperliquid
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
