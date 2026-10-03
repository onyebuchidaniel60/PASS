# PASS — Source of Truth

This repository contains the authoritative product and engineering specifications for PASS.

## Product

**PASS** is a social execution layer for Hyperliquid that turns a trader's trade plan into a shareable, executable Pass that another trader can discover, evaluate, and independently take.

**Core phrase:** See a trade. Know the trader. Take the trade.

## Source-of-truth hierarchy

When documents disagree, resolve them in this order:

1. `docs/DECISIONS.md` — explicit decisions and overrides.
2. `docs/PRODUCT_PRD.md` — product behavior and MVP scope.
3. `docs/TECHNICAL_SPEC.md` — architecture and implementation constraints.
4. `docs/DATA_MODEL.md` — persistence model and invariants.
5. `docs/API_CONTRACTS.md` — API contracts.
6. `docs/UX_SPEC.md` — screens and interaction behavior.
7. `docs/SECURITY_SPEC.md` — security and signing requirements.
8. `docs/EXTENSION_SPEC.md` — Chrome extension behavior.
9. `docs/TESTING_QA.md` — verification requirements.
10. `docs/DEPLOYMENT_OPERATIONS.md` — deployment and operational requirements.
11. `AGENTS.md` and `.clinerules` — implementation-agent behavior.
12. `docs/INTEGRATION_VERIFICATION.md` — external dependency facts verified against current official documentation; implementation must re-check live APIs when building.
13. `docs/HACKATHON_SUBMISSION.md` — competition-specific constraints and submission framing.

## Working method

The first implementation is intended to be a **complete one-shot build**. It includes the web app, backend, database, Hyperliquid integration, X integration, Ethos integration, Chrome extension, and deployment.

After the first complete build:

`Build everything -> Deploy -> Use -> Identify gaps -> Fix -> Redeploy -> Repeat`

The initial build is not required to be visually or behaviorally perfect. It is required to be complete enough to expose real product and integration problems.

## External verification date

External integrations in these documents were checked against official documentation on **2026-10-03**. Re-check before final release because external APIs and policies can change.

## Core external references

- Hyperliquid Exchange API: https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/exchange-endpoint
- Hyperliquid API wallets / nonces: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets
- Hyperliquid Info API: https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/info-endpoint
- Hyperliquid WebSocket subscriptions: https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/websocket/subscriptions
- Ethos API: https://help.ethos.network/en/articles/16881347-how-do-i-use-the-ethos-api
- Ethos X identity: https://help.ethos.network/en/articles/9764447-how-do-i-join-ethos-and-create-a-profile
- Ethos credibility score: https://help.ethos.network/en/articles/9763182-how-are-credibility-scores-determined
- X Create Posts: https://docs.x.com/x-api/posts/create-post
- Chrome Manifest V3: https://developer.chrome.com/docs/extensions/mv3/manifest
- Chrome service workers: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- Chrome scripting: https://developer.chrome.com/docs/extensions/reference/api/scripting
- Vercel preview deployments: https://vercel.com/academy/svelte-on-vercel/preview-deployments
- Colosseum Crypto World's Fair: https://colosseum.com/worldsfair

## Directory

```text
PASS/
├── README.md
├── AGENTS.md
├── .clinerules
└── docs/
    ├── PRODUCT_PRD.md
    ├── TECHNICAL_SPEC.md
    ├── DATA_MODEL.md
    ├── API_CONTRACTS.md
    ├── UX_SPEC.md
    ├── SECURITY_SPEC.md
    ├── EXTENSION_SPEC.md
    ├── TESTING_QA.md
    ├── DEPLOYMENT_OPERATIONS.md
    ├── INTEGRATION_VERIFICATION.md
    ├── IMPLEMENTATION_PLAN.md
    ├── DECISIONS.md
    ├── AI_HANDOFF.md
    └── HACKATHON_SUBMISSION.md
```
