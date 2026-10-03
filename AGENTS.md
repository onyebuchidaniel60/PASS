# PASS — Coding Agent Rules

You are implementing an already-defined product. Do not redesign the product, invent features, or change core behavior unless the source-of-truth documents explicitly permit it.

## Authority

Read `README.md`, `docs/DECISIONS.md`, `docs/PRODUCT_PRD.md`, `docs/TECHNICAL_SPEC.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/UX_SPEC.md`, `docs/SECURITY_SPEC.md`, and `docs/EXTENSION_SPEC.md` before substantial implementation.

## Time box

`docs/HACKATHON_SUBMISSION.md` records the submission deadline as 2026-10-12. Prefer a working, deployed, end-to-end product over polish. Where a choice exists between a more complete feature and a working shipped path, ship the working path.

## Agent rule files

`AGENTS.md` is the authoritative coding-agent rule file for OpenCode. `.clinerules` is retained for compatibility with an earlier tool and is non-authoritative. Do not edit, delete, or obey `.clinerules`. If the two ever disagree, `AGENTS.md` wins.

## Product behavior

PASS is not a generic copy-trading system. A Pass represents a specific trader-authored trade plan. A Taker independently chooses position size and authorizes their own Hyperliquid execution.

Do not introduce:

- automated copy trading;
- AI trade generation;
- custodial funds;
- token/DAO mechanics;
- multi-exchange support in MVP;
- multi-chain support in MVP;
- social chat/groups in MVP;
- unnecessary trading-terminal functionality.

## One-shot build requirement

The first implementation must include all major surfaces:

- web application;
- backend/API;
- PostgreSQL database;
- X identity and sharing;
- Ethos reputation context;
- Hyperliquid market data;
- Hyperliquid execution;
- stateful Pass lifecycle;
- trading/Pass analytics;
- Chrome Manifest V3 extension;
- deployment to Vercel plus production backend/database.

Do not deliberately defer the extension from the first build.

Frontend visual design is executed in a separate track after the one-shot build, per `docs/DECISIONS.md` D-017. Do not gate the one-shot completion on visual completeness.

## Implementation style

- Prefer simple, explicit TypeScript.
- Use strict typing.
- Validate external inputs with Zod or equivalent schema validation.
- Keep provider-specific code behind integration modules.
- Never spread Hyperliquid/X/Ethos API calls through unrelated business logic.
- Make domain behavior testable without network access.
- Use feature flags/configuration for risky integrations where useful, but do not hide unfinished core functionality behind permanent flags.

## Hyperliquid

- Use the current official API/SDK/documented signing flow.
- Do not hand-roll signing serialization when an official SDK or documented implementation exists.
- API wallets are also called agent wallets in Hyperliquid documentation.
- Agent/API wallet keys are signers; account reads use the actual master/subaccount address, not the agent address.
- Prefer a client-held agent key for the MVP self-custody model. The server must never receive a master private key or seed phrase and should not persist client agent private keys.
- Every execution must be explicitly confirmed by the Taker.
- Use nonce and expiry protections where supported.

The PASS backend relays signed Hyperliquid actions; it never holds signing keys. See `docs/DECISIONS.md` D-018.3 and D-018.9.

## Security

Treat browser code, extension code, and backend code as separate trust boundaries.

Never log:

- private keys;
- seed phrases;
- raw wallet secrets;
- OAuth client secrets;
- OAuth refresh tokens in plaintext logs.

Never store wallet secrets in localStorage.

## Chrome extension

Use Manifest V3. Keep permissions as narrow as possible. The extension is a discovery/context layer, not a second trading terminal.

Do not put private keys into content-script state. Do not inject remote executable code. Keep the web app responsible for actual trading/signing UX.

## UI and Frontend

Follow the design document, the frontend implementation plan, and `SKILL_FRONTEND_DESIGN.md` for all frontend work, including agent-as-user browser verification.

- The design blueprint is `design/DESIGN.md`.
- The build plan is `design/FRONTEND_IMPLEMENTATION_PLAN.md`.
- Visual references are direction, not specification: `design/references/`.
- `SKILL_FRONTEND_DESIGN.md` is a read-only craft skill. Do not edit it.
- No screen is done because it compiles, passes tests, or matches a snapshot. It is done when it has been rendered, opened, used as a user, measured, and compared against `design/DESIGN.md`.
- If a screen needs a visual decision `design/DESIGN.md` does not cover, stop and record the gap. Never invent visual language to fill it.

## Deployment

The first implementation is not complete until a live deployment exists and the major flows work against deployed services.

At minimum:

1. build locally;
2. run unit/integration tests;
3. build the extension package;
4. deploy web frontend to Vercel;
5. deploy backend/worker and database;
6. run smoke tests against deployed services;
7. report the deployed URLs and any unresolved issues.

## Iteration

After the first deployment, bugs and UX problems are expected. Fix them through normal iterations.

For meaningful changes:

1. reproduce;
2. identify root cause;
3. update the affected tests/spec if the contract was unclear;
4. implement the smallest correct change;
5. run targeted tests;
6. run the full relevant test suite;
7. redeploy;
8. re-check the affected flow.

## Do not hide gaps

If an external dependency is unavailable or a required API capability cannot be verified, do not fake it. Add a documented adapter, fixture, or clearly scoped fallback and record the gap in `docs/INTEGRATION_VERIFICATION.md`.
