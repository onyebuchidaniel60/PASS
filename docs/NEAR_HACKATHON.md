# PASS × NEAR Hackathon

> **PASS is the social execution layer for Hyperliquid that uses NEAR's
> Confidential Intents to provide Dark Pool privacy for social traders and AI
> agents.**

PASS turns a trader's plan into a shareable Pass. Another trader — or an AI
agent — can discover it, size it independently, and authorize execution on
Hyperliquid with their own wallet. The NEAR integration adds the missing piece
for professional social trading: a private funding rail that separates the
wallet that pays from the account that trades.

## The problem

Social trading leaks a graph. A trader's funding wallet is publicly linked to
the account that takes positions, so competitors can copy flow, front-run
withdrawals, or deanonymize a strategy. Centralized "privacy" fixes that by
taking custody, which defeats the point of Hyperliquid execution.

AI agents make the leak worse: a bot's treasury, its operator, and every Pass it
takes become one searchable cluster.

## The solution

PASS combines three non-custodial layers:

1. **Hyperliquid execution.** The taker or agent signs the order; PASS relays
   the signed payload. No key ever reaches the server.
2. **NEAR Confidential Intents.** Cross-chain USDC funding is routed through
   1Click with `confidentiality: "basic"`, so the deposit and the HyperCore
   withdrawal cannot be linked on-chain.
3. **Agent-scoped permissions.** The Hyperliquid agent key can place and cancel
   trades only. Withdrawals, transfers, and account changes require the master
   wallet.

The result is a Dark Pool for social traders: the Pass and its performance are
public, the funding-to-trading link is private, and execution stays
self-custodial.

## Track mapping

### DFI — Unstoppable DeFi

- **Fund with Any Chain** in Settings.
- `POST /api/v1/funding/intents/quote` calls the NEAR 1Click API.
- Supports USDC/USDT/native assets from Ethereum, Arbitrum, Base, Optimism,
  Polygon, Solana, NEAR, Bitcoin, Avalanche, and BNB Chain.
- Destination defaults to USDC on HyperCore, so funds land directly in the
  user's PASS trading account.
- No bridge UI, no PASS custody, no manual wrapping.

### SEC — AI Security & Defense

- **Security dashboard** in Settings shows Approved / Not Approved agent status.
- Explicit permission list: cannot withdraw funds, cannot transfer tokens,
  cannot change account settings.
- **Revoke Agent Key** uses Hyperliquid's deregistration flow: a throwaway
  unnamed agent is approved by the master wallet, which deregisters PASS's
  current agent, then PASS clears its local association.
- **Privacy Enabled** badge reflects the Confidential Intents preference.
- The server never holds an agent key or a master key.

### AGT — Agent Economy

- `GET /api/v1/agent/passes` returns clean, execution-oriented Pass JSON.
- `POST /api/v1/agent/execute` accepts `passId`, `agentWalletAddress`, and a
  pre-signed Hyperliquid `signedPayload`.
- No browser session is required. The signed action is the authority.
- Optional `clientRequestId` makes retries idempotent.
- Settings includes an **Agent Access** section with request examples and a
  hackathon-only mock API key generator.

### NEW — Documentation & branding

- This pitch.
- README sections for NEAR Intents, Confidential Trading, Agent Economy, and
  Non-Custodial Security.
- The "Powered by NEAR Intents" badge in the funding flow.

## Architecture

```text
Funding wallet (any chain)
        │  deposit
        ▼
NEAR 1Click quote ── confidentiality: "basic" ──► NEAR private shard
        │                                              │
        │                                              ▼
        └──────────────► HyperCore USDC ◄──── settlement
                                │
                                ▼
                     PASS trading account
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
      Human Take flow                     Agent Execution API
   (browser wallet signs)              (agent wallet signs)
              │                                   │
              └──────────► PASS relay ◄───────────┘
                                │
                                ▼
                     Hyperliquid Exchange API
```

## API surface

### Funding quote

```http
POST /api/v1/funding/intents/quote
Content-Type: application/json

{
  "sourceChain": "ethereum",
  "sourceToken": "USDC",
  "destinationAddress": "0xYourPASSTradingAccount",
  "amount": "100",
  "isConfidential": true
}
```

Response highlights:

```json
{
  "depositAddress": "0x…",
  "confidentiality": "basic",
  "source": { "chain": "ethereum", "token": "USDC", "amount": "100" },
  "destination": { "chain": "hypercore", "address": "0x…" },
  "transactionPayload": { "to": "0x…", "chain": "eth", "amount": "100000000" }
}
```

### Agent discovery

```http
GET /api/v1/agent/passes?limit=20
```

Each item carries `passId`, `version`, `asset`, `marketClass`, `direction`,
`status`, `entryType`, `entryPrice`, `stopLoss`, `takeProfit`, `leverage`,
`thesis`, `publishedAt`, `expiresAt`, and `canonicalPath`.

### Agent execution

```http
POST /api/v1/agent/execute
Content-Type: application/json

{
  "passId": "8xK29",
  "agentWalletAddress": "0xYourHyperliquidAccount",
  "clientRequestId": "bot-2026-11-13-001",
  "signedPayload": {
    "exchangeRequest": { "action": { "type": "order", "orders": [] } },
    "signature": { "r": "0x…", "s": "0x…", "v": 27 }
  }
}
```

### Agent revocation

```http
POST /api/v1/trading-accounts/:address/revoke-agent
```

The body is a master-wallet-signed `approveAgent` payload for a throwaway
replacement address. PASS relays it and clears the local approval.

## Demo script

1. Open **Settings → Funding**. Click **Fund with Any Chain**.
2. Choose Ethereum → USDC, enter `100`, enable **Use Confidential Intents
   (Privacy)**. Point out the "Powered by NEAR Intents" badge and the privacy
   note.
3. Generate the quote. Show the deposit address and the `confidentiality:
   "basic"` response from the API.
4. Open **Settings → Security**. Show **Approved**, the three forbidden
   permissions, and **Privacy Enabled**.
5. Click **Revoke Agent Key**, confirm, and show the status flip to **Not
   Approved**.
6. Open **Settings → Agent Access**. Generate a mock API key and show the
   `GET /agent/passes` and `POST /agent/execute` examples.
7. Optional: run `GET /api/v1/agent/passes` from a terminal against the live API.

## Configuration

| Variable | Meaning |
|---|---|
| `NEAR_INTENTS_MODE` | `mock` for deterministic local quotes, `live` for 1Click |
| `NEAR_INTENTS_API_URL` | 1Click base URL |
| `NEAR_INTENTS_JWT` | Bearer token; required by 1Click for confidential quotes |
| `NEAR_INTENTS_DESTINATION_ASSET` | Override the default HyperCore USDC asset |

Mock mode makes no network call, so the demo and test suite work offline. Live
confidential quotes return a clear `PROVIDER_UNAVAILABLE` error if the JWT is
missing rather than silently downgrading to a public swap.

## Safety boundaries

- PASS never receives a funding-wallet key, an agent key, or a master key.
- The funding quote is informational; the user pays the deposit address from
  their own wallet.
- Confidentiality hides the funding-to-trading link. Hyperliquid positions
  remain venue-visible; this is not a claim of trade secrecy.
- Agent execution reuses the existing Pass-version, idempotency, relay, and
  recording checks. The core signing and order-building code is unchanged.
- Revocation is the documented Hyperliquid replacement flow, not a fabricated
  "delete key" endpoint.

## What is live today

- Web and API run against Hyperliquid Testnet.
- NEAR Intents defaults to mock mode until `NEAR_INTENTS_MODE=live` and a 1Click
  JWT are configured.
- The Hyperliquid execution path is unchanged; the new surface is additive.
