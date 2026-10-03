# PASS — AI Implementation Handoff

## Mission

Build PASS exactly as defined by the source-of-truth documents and get a complete first version deployed. Treat the coding agent as an implementation engine, not a product strategist.

## Product in one paragraph

PASS lets a Trader turn a Hyperliquid trade plan into a shareable Pass. The Pass is distributed through X, enriched with the Trader's X identity and Ethos reputation context, and can be independently taken by another Trader who selects their own position size and authorizes execution on Hyperliquid. PASS is non-custodial.

## Mandatory first-build surfaces

- responsive web application;
- authenticated onboarding/profile;
- Pass creation/edit/publish/cancel;
- public Pass page;
- Trader profile;
- discovery;
- Ethos reputation context;
- X identity/sharing;
- Hyperliquid market/account data;
- Hyperliquid API-wallet/agent execution;
- execution tracking;
- Pass lifecycle;
- PASS performance analytics;
- Chrome MV3 extension for X context/discovery;
- deployed web/API/database.

## Hard constraints

1. Do not store seed phrases or master private keys.
2. Do not send client-held agent private keys to the server.
3. Do not implement automatic copy trading.
4. Do not create a synthetic trust score.
5. Do not silently rewrite historical Pass versions.
6. Do not execute a stale Pass without a fresh review.
7. Do not let the extension become a trading-key holder.
8. Do not invent unsupported provider fields.
9. Do not claim unverified metrics.
10. Do not call the project complete without a live deployment.

## Architecture expectations

Use provider adapters:

```text
Domain -> Hyperliquid adapter
Domain -> Ethos adapter
Domain -> X adapter
```

Provider payloads should be normalized before reaching domain code/UI.

## Execution expectations

The current Hyperliquid architecture exposes API/agent wallets for signing. Use the current official SDK/documented signing path. Keep the user's account address separate from the agent signer address. Verify nonce, expiration, and order status rules against the current provider docs before final release.

## UI expectations

The Pass page must answer:

- who is the Trader?
- what is the trade?
- why is the Trader taking it?
- what are the entry/TP/SL/leverage parameters?
- is the Pass still active?
- what exactly will my own account do if I take it?

## Extension expectations

Manifest V3.

The extension detects X contexts, shows minimal PASS context, and links to the web application. It should not own private trading credentials or execute orders directly.

## Definition of done

A user who finds a PASS link from X can:

```text
open Pass
-> inspect Trader
-> inspect Ethos context
-> inspect Trade Plan
-> choose own position size
-> review current market/order parameters
-> authorize
-> execute on Hyperliquid
-> see execution status
```

A Trader can:

```text
connect identity
-> create Pass
-> publish
-> share on X
-> monitor execution/outcome
```

The extension can:

```text
load on X
-> recognize relevant Trader/post
-> show PASS context
-> open correct Pass/profile
```

## When blocked

Do not improvise a product decision to unblock yourself. Prefer:

- current source-of-truth decision;
- official provider docs;
- a minimal adapter/fallback;
- a documented unresolved gap.

## Reporting

At the end of the first build, report:

- repository structure;
- commit SHA;
- test summary;
- deployed frontend URL;
- deployed API URL;
- database status;
- extension artifact path;
- integration status for Hyperliquid/X/Ethos;
- known bugs/gaps;
- recommended first iteration targets.
