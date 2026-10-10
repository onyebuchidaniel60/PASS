# PASS — Integration Verification Notes

**Verified:** 2026-10-03
**Rule:** External providers change. Re-check current official documentation before final release.

## 1. Hyperliquid — API wallets / agent wallets

Hyperliquid's official documentation calls API wallets "API wallets" and notes that they are also referred to as "Agent Wallets". A master account can approve API wallets to sign on behalf of the master account or its subaccounts. The API wallet is a signer; queries for account data must use the master/subaccount address, not the agent address.

Official references:

- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets
- https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/exchange-endpoint

## 2. Hyperliquid — approveAgent

The current Exchange API documents an `approveAgent` action. It accepts the Hyperliquid chain, signing chain ID, agent address, optional agent name, and nonce, and requires a signature.

The current docs state that an account may have one unnamed approved API wallet and up to three named ones, with additional named agents allowed per subaccount.

Reference:

https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/exchange-endpoint

## 3. Hyperliquid — orders

The Exchange API is the current endpoint for trading interactions. The order payload includes asset, buy/sell side, price, size, reduce-only flag, order type, optional client order ID, grouping, and optional builder fee information. Requests include nonce/signature and can support an expiry timestamp where applicable.

Reference:

https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/exchange-endpoint

## 4. Hyperliquid — account data

The Info API documents current market mids, open orders, and user-role/account queries. The documentation specifically warns that account data must be queried against the actual user/master/subaccount address rather than the agent address.

Reference:

https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/info-endpoint

## 5. Hyperliquid — live streams

The WebSocket subscriptions documentation currently includes channels for all mids, order updates, trades, books, and frontend-oriented user data.

Reference:

https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/websocket/subscriptions

## 6. Hyperliquid — entry/PnL interpretation

Hyperliquid documents entry price and PnL as frontend convenience concepts calculated from trades/margin rather than fundamental on-chain accounting primitives. PASS should therefore label its calculated statistics accurately and not pretend a provider/frontend field is an independently settled accounting fact.

Reference:

https://hyperliquid.gitbook.io/hyperliquid-docs/trading/entry-price-and-pnl

## 7. Ethos — API

Ethos currently states that its API is public and uses request headers rather than an API key. The documentation points developers to `developers.ethos.network` for current endpoint details.

Reference:

https://help.ethos.network/en/articles/16881347-how-do-i-use-the-ethos-api

## 8. Ethos — X identity

Ethos currently allows X to be connected as an attested identity. It pulls the X profile name/avatar and associates eligible prior reviews/vouches with the new Ethos profile.

Reference:

https://help.ethos.network/en/articles/9764447-how-do-i-join-ethos-and-create-a-profile

## 9. Ethos — reputation interpretation

Ethos currently describes credibility scores as community-driven sentiment based on public interactions. It explicitly says scores are not an absolute measure of credibility, trustworthiness, or character and may change as new data arrives.

Reference:

https://help.ethos.network/en/articles/9763182-how-are-credibility-scores-determined

## 10. Ethos — onchain/offchain distinction

Ethos currently states that reviews, vouches, slashes, attestations, invitations, voting, and comments are stored onchain, while credibility scores are currently calculated/stored offchain.

Reference:

https://help.ethos.network/en/articles/9814058-what-ethos-data-is-stored-onchain

## 11. X — Create Post

Current X API documentation provides `POST https://api.x.com/2/tweets` for creating posts with a bearer token. The documentation lists the post request body and notes that some quote-posting capabilities require Enterprise.

Reference:

https://docs.x.com/x-api/posts/create-post

## 12. Chrome — Manifest V3

Current Chrome extension documentation describes Manifest V3 and uses an extension service worker as the background/event handler. Content scripts and `chrome.scripting` can inject JavaScript/CSS into permitted pages.

References:

- https://developer.chrome.com/docs/extensions/mv3/manifest
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- https://developer.chrome.com/docs/extensions/reference/api/scripting

## 13. Chrome — permissions

Chrome documents separate manifest fields for normal permissions, optional permissions, host permissions, and optional host permissions. PASS should request only the minimum needed access.

Reference:

https://developer.chrome.com/docs/extensions/mv3/declare_permissions

## 14. Chrome — remotely hosted code

Manifest V3 does not support remotely hosted executable extension code. All executable extension code must be included in the extension package.

Reference:

https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3

## 15. Vercel — previews

Vercel's current preview workflow provides a deployment per non-production branch/PR, each with its own URL and environment. This supports the PASS iteration model.

Reference:

https://vercel.com/academy/svelte-on-vercel/preview-deployments

## 16. Colosseum — Crypto World's Fair

The current event page states the Crypto World's Fair is an online hackathon open across crypto ecosystems, with submissions due October 12, 2026. The page currently advertises $840,000 in prizes and $2.5 million in seed funding through the accelerator opportunity.

Reference:

https://colosseum.com/worldsfair

## 17. Build-recorded gaps

Added during the one-shot build. These are capabilities that are **not** implemented and are not faked.

### 17.1 Live client-side Hyperliquid signing — wired 2026-10-10

`TakeFlowClient.authorize()` builds the bracket with `buildOrderAction`
and signs it via `signExchangeRequest`: mock mode produces the
correctly shaped placeholder envelope; live mode signs with the
client-held agent key through viem's official EIP-712 primitive
(D-019.1 stack — no hand-rolled serialization, no `hyperliquid` npm
dependency added). Live mode without a key throws and sends nothing.
`hyperliquidExecution` remains `mock` on deployed services, so the
wired path exercises relay, validation order and idempotency without
moving funds. Status 2026-10-10: wired, mock-verified in tests, no live
mainnet submission yet (see `docs/EXECUTION_READINESS.md` §6.4).

### 17.2 `approveAgent` — requires a browser wallet connector

The MVP flow is: generate an agent/API wallet in the browser, have the Trader approve it via Hyperliquid's `approveAgent` action, then sign orders with the agent key. Step two requires a signature from the Trader's master wallet, which requires an injected wallet connector.

No connector is installed. Adding one is a product-visible choice about which wallets PASS supports, so it was left to the operator rather than chosen unilaterally. In mock mode an account address is linked directly and approval is skipped.

The server side of this flow already exists: `POST /api/v1/me/trading-accounts/agent-approved` records the approved agent address, and `agent_address` is stored separately from `account_address` and is never used as an Info API query subject (D-018.3).

### 17.3 Human-readable Pass URL served by the API only

Public Trader profile URLs are `/u/{slug}`, decided in `docs/DECISIONS.md` D-019.3, because Next.js App Router reserves a leading `@` for parallel route segments. The canonical immutable Pass URL `/p/{publicId}` is unaffected and remains the authoritative share target (D-018.4). This is now a settled convention rather than an open gap.

### 17.4 Local database is embedded PostgreSQL

No Docker and no local `psql` were available in the build environment. The database layer runs against real PostgreSQL via `DATABASE_URL` when present, and otherwise against PGlite (PostgreSQL compiled to WebAssembly) for local development and tests. The schema, migrations, and query layer are identical in both cases, so nothing about persistence is simulated. Production uses `DATABASE_URL` exclusively.
