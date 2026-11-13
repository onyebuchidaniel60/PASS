"use client";

import { useState } from "react";
import { Inline, Panel, Stack } from "@/components/wave1/layout";

/**
 * Agent Access (NEAR Hackathon AGT track).
 *
 * Explains the public Agent API and provides a UI-only mock API key for the
 * hackathon demo. The key is generated in the browser, never persisted, and
 * never sent to the API — the real execute endpoint authenticates the
 * pre-signed Hyperliquid order, not this string.
 */

function randomKey(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `pass_agent_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export interface AgentAccessProps {
  /** Injectable for tests; production uses the browser generator. */
  generateKey?: () => string;
}

export function AgentAccess({ generateKey = randomKey }: AgentAccessProps) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Panel>
      <Stack gap="4">
        <Stack gap="2">
          <h2 style={{ fontSize: "var(--type-title-s-size)" }}>Agent Access</h2>
          <p className="pass-stale">
            Build a trading bot against the same Passes humans use. The Agent
            API is read-only for discovery and relays a pre-signed Hyperliquid
            order for execution — it never accepts a key and cannot withdraw,
            transfer, or change account settings.
          </p>
        </Stack>

        <Stack gap="2">
          <strong>1. Discover active Passes</strong>
          <pre className="pass-agent-code">
{`GET /api/v1/agent/passes?limit=20

{
  "passes": [{
    "passId": "8xK29",
    "asset": "BTC",
    "direction": "long",
    "entryType": "limit",
    "entryPrice": "113400",
    "stopLoss": "111900",
    "takeProfit": "116000",
    "leverage": "5",
    "status": "active"
  }]
}`}
          </pre>
        </Stack>

        <Stack gap="2">
          <strong>2. Relay a pre-signed order</strong>
          <pre className="pass-agent-code">
{`POST /api/v1/agent/execute
Content-Type: application/json

{
  "passId": "8xK29",
  "agentWalletAddress": "0xYourHyperliquidAccount",
  "signedPayload": {
    "exchangeRequest": { "...": "signed Hyperliquid order" },
    "signature": { "r": "0x…", "s": "0x…", "v": 27 }
  }
}`}
          </pre>
          <p className="pass-stale">
            Sign the order with your own Hyperliquid agent wallet. PASS checks
            the Pass version, relays the payload, and records the execution.
            Add an optional <code>clientRequestId</code> to make retries
            idempotent.
          </p>
        </Stack>

        <div className="pass-agent-key-box">
          <Stack gap="3">
            <Inline gap="3" align="center">
              <button
                type="button"
                className="pass-btn"
                data-variant="primary"
                onClick={() => {
                  setApiKey(generateKey());
                  setCopied(false);
                }}
              >
                {apiKey ? "Generate another key" : "Generate mock API key"}
              </button>
              <span className="pass-badge" data-tone="active">
                Hackathon demo
              </span>
            </Inline>
            {apiKey ? (
              <>
                <code className="pass-agent-key" data-testid="agent-api-key">
                  {apiKey}
                </code>
                <Inline gap="3">
                  <button
                    type="button"
                    className="pass-btn"
                    data-variant="secondary"
                    onClick={copy}
                  >
                    {copied ? "Copied" : "Copy key"}
                  </button>
                </Inline>
              </>
            ) : null}
            <p className="pass-stale">
              UI only for the hackathon: this key is generated in your browser,
              is not stored, and is not checked by the API. Production API keys
              and scoped rate limits are the next step.
            </p>
          </Stack>
        </div>
      </Stack>
    </Panel>
  );
}
