import type { Metadata } from "next";
import Link from "next/link";

import {
  Inline,
  PageShell,
  Panel,
  Section,
  ShellContent,
  Stack,
} from "@/components/wave1/layout";
import {
  DisplayHeadline,
  NumberedEyebrow,
  Surface,
} from "@/components/reference";

export const metadata: Metadata = {
  title: "PASS — Developer Documentation",
  description:
    "Authenticate against the PASS Agent API, discover Passes, and relay pre-signed Hyperliquid orders.",
};

/**
 * Full Agent API documentation. Settings → Developers keeps only key
 * management and a quick start; the long examples live here so the tab stays
 * a workspace rather than a manual.
 */
export default function DevelopersPage() {
  return (
    <PageShell>
      <ShellContent className="pass-developers">
        <Stack gap="6">
          <Surface strength="section" className="pass-developers-head">
            <Stack gap="4">
              <NumberedEyebrow label="Developers" number={1} />
              <DisplayHeadline
                section
                as="h1"
                lines={[
                  [{ text: "Build" }, { text: "against" }],
                  [{ text: "the" }, { text: "execution", accent: true }, { text: "layer." }],
                ]}
              />
              <p className="pass-landing-lede">
                The PASS Agent API discovers live Passes and relays orders your
                own agent wallet has already signed. It never holds a private
                key and cannot withdraw, transfer, or change account settings.
              </p>
              <Inline gap="3">
                <Link href="/settings?tab=developers" className="pass-btn" data-variant="secondary">
                  Manage API keys
                </Link>
                <Link href="/discover" className="pass-btn" data-variant="ghost">
                  Explore Passes
                </Link>
              </Inline>
            </Stack>
          </Surface>

          <Section label="Authentication">
            <Stack gap="4">
              <NumberedEyebrow label="Authentication" number={2} />
              <h2 className="pass-developers-title">Bearer keys.</h2>
              <p className="pass-note">
                Create a key in Settings → Developers. The plaintext key is
                shown once. Send it on every Agent request; PASS stores only a
                SHA-256 hash and revokes keys immediately.
              </p>
              <pre className="pass-agent-code">
{`GET /api/v1/agent/passes?limit=20
Authorization: Bearer pass_agt_<your-key>`}
              </pre>
            </Stack>
          </Section>

          <Section label="Discovery">
            <Stack gap="4">
              <NumberedEyebrow label="Discovery" number={3} />
              <h2 className="pass-developers-title">Find executable plans.</h2>
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
                Prediction-market Passes carry <code>marketClass: "hip4"</code>{" "}
                and an <code>outcome</code> object with the market name and
                YES/NO side. They execute in USDH with no leverage or venue
                exits.
              </p>
            </Stack>
          </Section>

          <Section label="Execution">
            <Stack gap="4">
              <NumberedEyebrow label="Execution" number={4} />
              <h2 className="pass-developers-title">Relay a signed order.</h2>
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
                The signed Hyperliquid action is the authority. PASS checks the
                Pass version, relays the payload, records the execution, and
                reconciles the result. Send the same <code>clientRequestId</code>{" "}
                on a retry to keep it idempotent.
              </p>
            </Stack>
          </Section>

          <Section label="Key management">
            <Stack gap="4">
              <NumberedEyebrow label="Key management" number={5} />
              <h2 className="pass-developers-title">Create, list, revoke.</h2>
              <Panel>
                <Stack gap="3">
                  <pre className="pass-agent-code">
{`POST   /api/v1/agent/keys
GET    /api/v1/agent/keys
DELETE /api/v1/agent/keys/:id`}
                  </pre>
                  <p className="pass-note">
                    Key management is session-authenticated. The Agent endpoints
                    are Bearer-authenticated and session-free, so a bot can run
                    headless.
                  </p>
                </Stack>
              </Panel>
            </Stack>
          </Section>
        </Stack>
      </ShellContent>
    </PageShell>
  );
}
