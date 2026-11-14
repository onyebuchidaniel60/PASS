"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Inline,
  PageShell,
  Panel,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import {
  DisplayHeadline,
  NumberedEyebrow,
  Surface,
} from "@/components/reference";

const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "traders", label: "Getting Started (Traders)" },
  { id: "takers", label: "Getting Started (Takers)" },
  { id: "predictions", label: "Prediction Markets" },
  { id: "agent-api", label: "Agent API" },
  { id: "architecture", label: "Architecture & Security" },
  { id: "faq", label: "FAQ & Troubleshooting" },
] as const;

export function DocsClient() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((element): element is HTMLElement => Boolean(element));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-18% 0% -68% 0%", threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <PageShell>
      <ShellContent className="pass-docs">
        <Surface strength="section" className="pass-docs-hero">
          <Stack gap="4">
            <span className="pass-settings-kicker">Documentation</span>
            <DisplayHeadline
              section
              as="h1"
              lines={[
                [{ text: "The" }, { text: "PASS" }, { text: "manual." }],
              ]}
            />
            <p className="pass-landing-lede">
              How traders publish, takers execute, and agents plug in — without
              handing over a private key. Start at the top or jump to the
              section you need.
            </p>
            <Inline gap="3">
              <Link
                href="/passes/new"
                className="pass-btn"
                data-variant="primary"
              >
                Create a Pass
              </Link>
              <Link
                href="/discover"
                className="pass-btn"
                data-variant="secondary"
              >
                Explore Passes
              </Link>
            </Inline>
          </Stack>
        </Surface>

        <div className="pass-docs-layout">
          <div className="pass-docs-sidebar-wrap">
            <button
              type="button"
              className="pass-docs-mobile-toggle"
              aria-expanded={open}
              aria-controls="pass-docs-nav"
              onClick={() => setOpen((value) => !value)}
            >
              <span>Sections</span>
              <span aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            <aside
              className="pass-docs-sidebar"
              data-open={open ? "true" : undefined}
            >
              <nav id="pass-docs-nav" aria-label="Documentation sections">
                <ol className="pass-docs-nav">
                  {SECTIONS.map((section, index) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        data-active={active === section.id ? "true" : undefined}
                        onClick={() => setOpen(false)}
                      >
                        <span className="pass-docs-nav-index" aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{section.label}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
          </div>

          <article className="pass-docs-content">
            <section
              id="introduction"
              data-docs-section
              className="pass-docs-section"
            >
              <NumberedEyebrow label="Introduction" number={1} />
              <h2 className="pass-docs-heading">What is PASS?</h2>
              <div className="pass-docs-copy">
                <p>
                  PASS is a social execution layer for Hyperliquid. A trader
                  publishes a structured trade plan as a <strong>Pass</strong>.
                  A taker reads the plan, chooses their own size, and authorizes
                  the order with their own wallet.
                </p>
                <p>
                  The Pass is the public object: thesis, levels, expiry, and
                  live state. The execution is private to the taker: their
                  wallet signs, PASS relays, and Hyperliquid fills. PASS never
                  holds funds or a private key.
                </p>
              </div>
              <div className="pass-docs-facts">
                <div>
                  <span>Non-custodial</span>
                  <strong>Your wallet signs</strong>
                </div>
                <div>
                  <span>Versioned</span>
                  <strong>Every execution names its version</strong>
                </div>
                <div>
                  <span>Social</span>
                  <strong>Shareable on X, executable on PASS</strong>
                </div>
              </div>
              <div className="pass-docs-callout">
                <strong>New here?</strong>
                <p>
                  Start with{" "}
                  <Link href="/passes/new" className="pass-link-btn">
                    Create a Pass
                  </Link>{" "}
                  or browse{" "}
                  <Link href="/discover" className="pass-link-btn">
                    Discover
                  </Link>
                  . The first time you take a Pass, your wallet approves a
                  Hyperliquid agent key that can place and cancel trades only.
                </p>
              </div>
            </section>

            <section id="traders" data-docs-section className="pass-docs-section">
              <NumberedEyebrow label="Traders" number={2} />
              <h2 className="pass-docs-heading">Publish the plan.</h2>
              <div className="pass-docs-copy">
                <p>
                  A Trader publishes a plan, not a size instruction. Takers
                  choose their own risk. The Create Pass screen keeps the object
                  in view while you author it.
                </p>
              </div>
              <ol className="pass-docs-steps">
                <li>
                  <span className="pass-docs-step-index">01</span>
                  <div>
                    <strong>Connect X.</strong>
                    <p>
                      PASS identity is X-only. Connecting X is what attributes
                      the Pass to your public profile.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pass-docs-step-index">02</span>
                  <div>
                    <strong>Author the plan.</strong>
                    <p>
                      Perps: asset, direction, entry type and price, take profit,
                      stop loss, leverage (up to 10x), thesis, and expiry.
                      Prediction markets: outcome, YES/NO, limit probability,
                      reference size, thesis, and expiry.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pass-docs-step-index">03</span>
                  <div>
                    <strong>Publish.</strong>
                    <p>
                      Publish is disabled until every required field is valid.
                      The alert above the action names the fields that need
                      attention. A published Pass becomes a shareable public
                      URL.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pass-docs-step-index">04</span>
                  <div>
                    <strong>Share the link.</strong>
                    <p>
                      Copy the public URL or share it on X. A taker can read the
                      full thesis and levels before connecting a wallet.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="pass-docs-callout">
                <strong>Editing is versioned.</strong>
                <p>
                  Changing an execution-relevant field mints a new Pass version.
                  An execution always records the exact version that was live
                  when the taker authorized it.
                </p>
              </div>
            </section>

            <section id="takers" data-docs-section className="pass-docs-section">
              <NumberedEyebrow label="Takers" number={3} />
              <h2 className="pass-docs-heading">Size it yourself. Sign it yourself.</h2>
              <div className="pass-docs-copy">
                <p>
                  Taking a Pass is four steps. Nothing is copied automatically,
                  and no key material reaches PASS.
                </p>
              </div>
              <ol className="pass-docs-steps">
                <li>
                  <span className="pass-docs-step-index">01</span>
                  <div>
                    <strong>Discover.</strong>
                    <p>
                      Filter by market type and status. Read the asset,
                      direction, levels, thesis, and expiry.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pass-docs-step-index">02</span>
                  <div>
                    <strong>Choose your size.</strong>
                    <p>
                      The size is yours. The preview shows the exact order
                      numbers and fees before anything is signed.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pass-docs-step-index">03</span>
                  <div>
                    <strong>Authorize.</strong>
                    <p>
                      Connect a wallet and sign. On the first execution, your
                      wallet approves a Hyperliquid agent key. PASS relays the
                      signed action; Hyperliquid executes it.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="pass-docs-step-index">04</span>
                  <div>
                    <strong>Track the receipt.</strong>
                    <p>
                      The execution appears in{" "}
                      <Link href="/me/executions" className="pass-link-btn">
                        Executions
                      </Link>{" "}
                      with the provider order id, status, and realized result.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="pass-docs-callout pass-docs-callout--warn">
                <strong>Your trading account must be funded.</strong>
                <p>
                  If Hyperliquid answers “Must deposit before performing
                  actions,” PASS shows a deposit card instead of the raw venue
                  error. Deposit USDC to your Hyperliquid account, then retry.
                  See the FAQ below.
                </p>
              </div>
            </section>

            <section
              id="predictions"
              data-docs-section
              className="pass-docs-section"
            >
              <NumberedEyebrow label="Prediction markets" number={4} />
              <h2 className="pass-docs-heading">Binary YES / NO markets.</h2>
              <div className="pass-docs-copy">
                <p>
                  PASS supports HIP-4 outcome markets on Hyperliquid. Each market
                  is a binary question with a YES side and a NO side. Collateral
                  is <strong>USDH</strong>.
                </p>
                <p>
                  Choose Prediction Markets on Create Pass, pick a live outcome,
                  choose YES or NO, set a limit probability between 0.01 and
                  0.99, and enter a reference size in USDH. Prediction Passes
                  have no leverage, take profit, stop loss, or perp entry price.
                </p>
              </div>
              <div className="pass-docs-facts">
                <div>
                  <span>Collateral</span>
                  <strong>USDH</strong>
                </div>
                <div>
                  <span>Price</span>
                  <strong>Probability 0.01–0.99</strong>
                </div>
                <div>
                  <span>Exits</span>
                  <strong>No venue TP/SL</strong>
                </div>
              </div>
              <div className="pass-docs-callout">
                <strong>Live venue data, filtered.</strong>
                <p>
                  The outcome picker reads Hyperliquid&apos;s live{" "}
                  <code>outcomeMeta</code>. Placeholder names containing
                  “template” or “fallback,” and the exact venue placeholders
                  “Recurring” and “Recurring Named Outcome,” are filtered out.
                  If nothing real remains, the picker is disabled and the page
                  says “No active prediction markets available at this time.”
                </p>
              </div>
            </section>

            <section
              id="agent-api"
              data-docs-section
              className="pass-docs-section"
            >
              <NumberedEyebrow label="Agent API" number={5} />
              <h2 className="pass-docs-heading">Let a bot execute your plan.</h2>
              <div className="pass-docs-copy">
                <p>
                  Create an API key in{" "}
                  <Link
                    href="/settings?tab=developers"
                    className="pass-link-btn"
                  >
                    Settings → Developers
                  </Link>
                  . The plaintext key is shown once. PASS stores a SHA-256 hash
                  and can revoke the key immediately.
                </p>
                <p>
                  Agent endpoints are Bearer-authenticated and session-free.
                  They can discover live Passes and relay a pre-signed
                  Hyperliquid order. They cannot withdraw, transfer, or change
                  account settings.
                </p>
              </div>

              <Panel>
                <Stack gap="3">
                  <h3 className="pass-docs-subheading">Authentication</h3>
                  <pre className="pass-agent-code">
{`Authorization: Bearer pass_agt_<your-key>`}
                  </pre>
                  <p className="pass-note">
                    Keep the key out of URLs, logs, and screenshots. The Agent
                    key is not a wallet key and never signs a transaction.
                  </p>
                </Stack>
              </Panel>

              <Panel>
                <Stack gap="3">
                  <h3 className="pass-docs-subheading">Discover active Passes</h3>
                  <pre className="pass-agent-code">
{`GET /api/v1/agent/passes?limit=20
Authorization: Bearer pass_agt_<your-key>

{
  "passes": [{
    "passId": "8xK29",
    "version": 3,
    "asset": "BTC",
    "marketClass": "perp",
    "direction": "long",
    "status": "active",
    "entryType": "limit",
    "entryPrice": "113400",
    "stopLoss": "111900",
    "takeProfit": "116000",
    "leverage": "5",
    "thesis": "BTC reclaimed the prior range high.",
    "publishedAt": "2026-11-14T10:00:00.000Z",
    "expiresAt": "2026-12-14T10:00:00.000Z",
    "canonicalPath": "/p/8xK29",
    "executeEndpoint": "/api/v1/agent/execute"
  }]
}`}
                  </pre>
                  <p className="pass-note">
                    Prediction-market Passes carry{" "}
                    <code>marketClass: &quot;hip4&quot;</code> and an{" "}
                    <code>outcome</code> object with the market name and YES/NO
                    side.
                  </p>
                </Stack>
              </Panel>

              <Panel>
                <Stack gap="3">
                  <h3 className="pass-docs-subheading">Relay a signed order</h3>
                  <pre className="pass-agent-code">
{`POST /api/v1/agent/execute
Authorization: Bearer pass_agt_<your-key>
Content-Type: application/json

{
  "passId": "8xK29",
  "agentWalletAddress": "0xYourHyperliquidAccount",
  "clientRequestId": "bot-2026-11-14-001",
  "signedPayload": {
    "exchangeRequest": { "...": "signed Hyperliquid order" },
    "signature": { "r": "0x…", "s": "0x…", "v": 27 }
  }
}`}
                  </pre>
                  <p className="pass-note">
                    The signed Hyperliquid action is the authority. PASS checks
                    the Pass version, relays the payload, records the execution,
                    and reconciles the result. Reuse{" "}
                    <code>clientRequestId</code> to make retries idempotent.
                  </p>
                </Stack>
              </Panel>

              <div className="pass-docs-callout">
                <strong>Full developer reference.</strong>
                <p>
                  Key management, response fields, and the complete execution
                  contract live on the{" "}
                  <Link href="/developers" className="pass-link-btn">
                    Developer Documentation
                  </Link>{" "}
                  page.
                </p>
              </div>
            </section>

            <section
              id="architecture"
              data-docs-section
              className="pass-docs-section"
            >
              <NumberedEyebrow label="Architecture" number={6} />
              <h2 className="pass-docs-heading">No custody. No owned wallets.</h2>
              <div className="pass-docs-copy">
                <p>
                  PASS is an execution layer, not a custodian. The server holds
                  no signing material. A wallet is an execution device, not a
                  PASS account: any connected wallet can take a Pass, signed in
                  or signed out.
                </p>
              </div>
              <div className="pass-docs-cards">
                <div>
                  <h3 className="pass-docs-subheading">D-027 — Wallets are unowned</h3>
                  <p>
                    A wallet is not associated with an account. Trading
                    accounts are keyed by provider and address; the user id is
                    informational. Executions reference the wallet address, not
                    ownership. The master wallet signature is the authority for
                    agent approval.
                  </p>
                </div>
                <div>
                  <h3 className="pass-docs-subheading">Agent key permissions</h3>
                  <p>
                    The Hyperliquid agent key can place and cancel trade orders.
                    It cannot withdraw funds, transfer tokens, or change account
                    settings. Those actions require the master wallet.
                  </p>
                </div>
                <div>
                  <h3 className="pass-docs-subheading">NEAR Intents funding</h3>
                  <p>
                    Cross-chain USDC funding routes through NEAR 1Click with{" "}
                    <code>confidentiality: &quot;basic&quot;</code>. The deposit
                    and the HyperCore settlement cannot be linked on-chain.
                    PASS never takes custody of the funds.
                  </p>
                </div>
                <div>
                  <h3 className="pass-docs-subheading">Builder fee</h3>
                  <p>
                    PASS charges a 0.05% builder fee on execution. The fee is
                    attached to the signed Hyperliquid action and is visible in
                    the preview before authorization.
                  </p>
                </div>
              </div>
            </section>

            <section id="faq" data-docs-section className="pass-docs-section">
              <NumberedEyebrow label="FAQ" number={7} />
              <h2 className="pass-docs-heading">Troubleshooting.</h2>
              <div className="pass-docs-faq">
                <details>
                  <summary>“Must deposit before performing actions.”</summary>
                  <p>
                    Your Hyperliquid trading account has no USDC. PASS replaces
                    the raw venue error with an Action Required card. Choose
                    <strong> Go to Hyperliquid to Deposit</strong>, fund the
                    account, then press <strong>Retry</strong>.
                  </p>
                </details>
                <details>
                  <summary>“No active prediction markets available.”</summary>
                  <p>
                    The live venue returned only placeholder outcomes or no
                    open markets. PASS filters names containing “template” or
                    “fallback” and the exact placeholders “Recurring” and
                    “Recurring Named Outcome.” Try again later; PASS does not
                    invent markets.
                  </p>
                </details>
                <details>
                  <summary>Why is Publish disabled?</summary>
                  <p>
                    One or more required fields are invalid. The alert above the
                    action names how many fields need attention; each field
                    carries its own message. The button enables as soon as the
                    form is valid.
                  </p>
                </details>
                <details>
                  <summary>Can PASS withdraw or move my funds?</summary>
                  <p>
                    No. PASS is non-custodial. Withdrawals, transfers, and
                    account changes require your master wallet signature and are
                    outside the agent key&apos;s permissions.
                  </p>
                </details>
                <details>
                  <summary>Where are my executions?</summary>
                  <p>
                    Open{" "}
                    <Link href="/me/executions" className="pass-link-btn">
                      Executions
                    </Link>{" "}
                    to see provider order ids, status, and realized results. A
                    signed-out taker can still view the public Pass page.
                  </p>
                </details>
                <details>
                  <summary>Why is my wallet not on my public profile?</summary>
                  <p>
                    Wallet addresses are execution-only and never appear on the
                    public profile. Identity is X-only. This is deliberate under
                    D-027.
                  </p>
                </details>
              </div>
            </section>
          </article>
        </div>
      </ShellContent>
    </PageShell>
  );
}
