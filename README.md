# PASS

Social execution for Hyperliquid: a trader's trade plan becomes a shareable Pass that another trader can take with their own wallet. See a trade. Know the trader. Take the trade.

## What it does

A trader authors a structured trade plan — entry, take-profit, stop-loss, size, leverage, thesis — and publishes it as a Pass link. Anyone can discover the Pass, evaluate the trader through their X identity and Ethos reputation, then take the trade: choose their own position size, review the order, and authorize execution on Hyperliquid with their own wallet. Nothing is copied automatically and no key ever leaves the taker's browser.

## How it works

1. A trader creates a Pass with entry, take-profit, stop-loss, size, leverage, and thesis, then publishes and shares it.
2. Anyone can discover the Pass on Discover, on the trader's profile, or from an X link — signed in or not.
3. The taker evaluates the trader (X identity, Ethos reputation context, PASS history) and the plan.
4. The taker chooses their own position size and reviews the live order preview.
5. The taker authorizes with their own wallet; PASS relays the signed order to Hyperliquid. Non-custodial throughout.

## NEAR Intents Integration

PASS can fund a trading account from another chain without asking the user to
bridge manually. The web app's **Fund with Any Chain** flow requests a quote
from the PASS API; the API calls NEAR's 1Click service and returns a deposit
address plus the transaction payload. The user pays that address from their own
funding wallet, and 1Click settles USDC into their HyperCore account.

```bash
curl -X POST https://pass-pz7f.onrender.com/api/v1/funding/intents/quote \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChain": "ethereum",
    "sourceToken": "USDC",
    "destinationAddress": "0xYourPASSTradingAccount",
    "amount": "100",
    "isConfidential": true
  }'
```

The API returns `depositAddress`, `transactionPayload`, the quoted amounts, and
`confidentiality: "basic"` when privacy is on. Funding is non-custodial: PASS
never receives the deposit or holds a key that could move it.

Relevant API environment variables:

| Variable | Purpose |
|---|---|
| `NEAR_INTENTS_MODE` | `mock` (default, deterministic quote, no network) or `live` |
| `NEAR_INTENTS_API_URL` | 1Click base URL; defaults to `https://1click.chaindefuser.com` |
| `NEAR_INTENTS_JWT` | Bearer token required by 1Click for confidential quotes |
| `NEAR_INTENTS_DESTINATION_ASSET` | Override the default USDC-on-HyperCore destination asset |

## Confidential Trading

Confidential Intents is NEAR's private execution layer for cross-chain swaps.
When the user enables **Use Confidential Intents (Privacy)**, PASS adds
`confidentiality: "basic"` to the 1Click quote request. The deposit and the
HyperCore withdrawal are settled through NEAR's private shard, so an observer
cannot link the funding wallet to the PASS trading account.

The trade itself still settles on Hyperliquid and remains visible as a venue
action. Confidentiality protects the funding-to-trading link, not the existence
of the position.

### Dark Pool privacy for social traders

A social trader has two identities that should not be joined by a public
block explorer: the wallet that funds the account and the account that takes
Passes. PASS uses NEAR Confidential Intents as a privacy membrane between
them. The trader can publish a Pass publicly, let takers evaluate it, and fund
the execution account privately — without running a custodial mixer or asking
users to trust a PASS-controlled wallet. The same rail serves AI agents that
need to operate without exposing their treasury graph.

## Agent Economy

The Agent Execution API lets a bot discover live Passes and submit a
pre-signed Hyperliquid order. It requires an Agent API key and no browser
session, and accepts no private key; the signature in the payload is the
authorization.

```text
GET    /api/v1/agent/passes?limit=20
POST   /api/v1/agent/execute
POST   /api/v1/agent/keys
GET    /api/v1/agent/keys
DELETE /api/v1/agent/keys/:id
```

Agent requests authenticate with `Authorization: Bearer pass_agt_...`.
Keys are generated in Settings → Developers, shown once, stored only as a
SHA-256 hash, and can be revoked immediately.

`GET /agent/passes` returns a clean execution-oriented payload: `passId`,
asset, direction, entry, stop, target, leverage, status, and expiry. It omits
UI-only reputation and market decoration. `POST /agent/execute` accepts
`passId`, `agentWalletAddress`, and `signedPayload`, then runs the same Pass
version, idempotency, relay, and recording checks as the human Take flow.

Settings includes an **Agent Access** section with live request examples, key
creation, one-time plaintext display, and revocation.

## Non-Custodial Security

PASS's Hyperliquid agent key can sign trade orders only. It cannot:

- withdraw funds;
- transfer tokens;
- change account settings.

The master wallet remains the only authority for those actions, and no private
key is ever sent to the PASS API. Settings has a **Security** section that shows
the venue-scoped agent status, the forbidden permissions, and a **Revoke Agent
Key** action. Revocation uses Hyperliquid's deregistration path: PASS approves a
throwaway replacement unnamed agent (which deregisters the current one) with a
master-wallet signature, then clears its local association. The throwaway
address is never stored and never signs an order.

See [docs/NEAR_HACKATHON.md](docs/NEAR_HACKATHON.md) for the hackathon pitch,
track mapping, and demo flow.

## Live

- Web: https://pass-web-dun.vercel.app
- API: https://pass-pz7f.onrender.com
- Runs against Hyperliquid Testnet today.

## Stack

Next.js, Fastify, Postgres (Supabase), Drizzle, Hyperliquid, Ethos, X, Chrome MV3 extension.

## Repository layout

```text
apps/web        Next.js web app
apps/api        Fastify API + in-process worker jobs
apps/extension  Chrome MV3 extension (discovery on X, hands off to web)
packages/       Shared contracts, domain, db, integrations, ui
docs/           Product and engineering source of truth
design/         Visual blueprint (DESIGN.md); reference media is local-only
scripts/        Verification, smoke, and check scripts
```

## Chrome extension (optional)

The PASS extension runs on X and surfaces PASS context next to
accounts and posts. It is optional. The web app works without it.

### Install instantly (pre-built)

A pre-built copy is committed at **`apps/extension/dist/`**. You do not need
Node, pnpm, or a build step to try it.

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the folder:

   ```text
   apps/extension/dist
   ```

5. Open x.com in a new tab. The PASS overlay appears on supported profile
   pages.

The pre-built bundle targets the deployed PASS API at
https://pass-pz7f.onrender.com and the web app at
https://pass-web-dun.vercel.app.

### Build from source (developers)

Source: `apps/extension/`

1. Install dependencies and build:

   ```bash
   pnpm install
   pnpm --filter @pass/extension build
   ```

2. Open `chrome://extensions`, enable Developer mode, click **Load unpacked**,
   and select `apps/extension/dist`.

3. Open x.com in a new tab. The extension overlay will appear on supported
   profile pages.

To rebuild after a source change:

```bash
pnpm --filter @pass/extension build
```

Then press **Reload** on the extension card in `chrome://extensions`. The
committed `apps/extension/dist/` folder is the artifact judges load directly;
keep it in sync when the extension source changes.

## Docs

Start with docs/ for the source of truth — docs/AI_HANDOFF.md for current state.

## Development

See docs/DEVELOPMENT.md for setup, environment, tests, and deployment.
The Chrome extension is optional — see "Chrome extension (optional)" above.
