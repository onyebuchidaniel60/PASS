# PASS — One-Shot Implementation & Iteration Plan

## 1. Objective

Produce a complete, deployed PASS v0.1 in one implementation effort, including:

- web application;
- API/backend;
- PostgreSQL schema/migrations;
- worker/background jobs;
- Hyperliquid market data and execution;
- X identity/sharing;
- Ethos reputation context;
- Pass lifecycle and analytics;
- Chrome Manifest V3 extension;
- CI/build configuration;
- Vercel frontend deployment;
- production backend/database deployment.

Do not intentionally leave an entire surface for a later phase.

## 2. Implementation order

The agent may build internally in phases, but the final first-pass result must be end-to-end.

### Stage A — Repository and foundation

- monorepo structure;
- TypeScript configuration;
- linting/formatting;
- env validation;
- database connection;
- shared domain/contracts packages;
- logging;
- health endpoint;
- base design system.

**STOP / VERIFY**

- repository installs cleanly;
- typecheck passes;
- lint passes;
- database migrations run;
- local web/API boot.

### Stage B — Identity

- PASS account/session;
- X connection;
- profile creation;
- Hyperliquid account association;
- Ethos resolution.

**STOP / VERIFY**

A test user can create a complete profile without exposing secrets.

### Stage C — Pass domain

- Pass schema;
- validation;
- versioning;
- lifecycle state machine;
- event log;
- create/edit/publish/cancel;
- public URL.

**STOP / VERIFY**

A Trader can create and publish a Pass; a logged-out browser can open it.

### Stage D — Public experience

- landing page;
- discover page;
- Pass page;
- Trader profile;
- social preview metadata;
- responsive/mobile UI.

**STOP / VERIFY**

A new visitor can understand a Pass without prior explanation.

### Stage E — Hyperliquid read integration

- market metadata;
- price/mid data;
- account state;
- open orders;
- fills/history required for displayed metrics;
- WebSocket/live updates where justified.

**STOP / VERIFY**

Provider data maps correctly into PASS DTOs and failure states are handled.

### Stage F — Hyperliquid execution

- agent/API-wallet generation;
- user approval;
- client-controlled signer;
- order intent construction;
- execution preview;
- signed payload handling;
- order submission;
- status reconciliation;
- idempotency;
- failure handling.

**STOP / VERIFY**

A controlled test account can take a Pass end-to-end without PASS receiving the master private key or seed phrase.

### Stage G — Performance and lifecycle

- execution-to-Pass attribution;
- Pass outcomes;
- performance aggregates;
- activity timeline;
- completed/closed state handling.

**STOP / VERIFY**

A completed execution produces deterministic PASS performance data and preserves its historical Pass version.

### Stage H — X distribution

- share link generation;
- share copy;
- OAuth integration where configured;
- optional native X post creation;
- Open Graph metadata.

**STOP / VERIFY**

A Trader can create a shareable X post/link without depending on the native-post API.

### Stage I — Chrome extension

- Manifest V3;
- service worker;
- X content script;
- profile/post detection;
- API resolution;
- PASS UI card;
- popup;
- deep links;
- permissions handling;
- extension build artifact.

**STOP / VERIFY**

The extension loads in Chrome, remains stable during X SPA navigation, and can take a user from X to a real PASS page.

### Stage J — Deployment

- production database;
- backend/worker deployment;
- Vercel project;
- environment variables;
- CORS/session configuration;
- production web deployment;
- extension artifact;
- production smoke tests.

**STOP / VERIFY**

The deployed product is usable end-to-end.

## 3. First deployment review

After the first full deployment, the owner should manually inspect:

- visual hierarchy;
- copy;
- mobile behavior;
- Pass creation;
- public Pass;
- Trader profile;
- Ethos context;
- X sharing;
- wallet/agent onboarding;
- execution preview;
- real order result;
- lifecycle status;
- extension overlay.

Record issues by category:

```text
P0 = security / funds / catastrophic correctness
P1 = critical user path broken
P2 = important UX or functional issue
P3 = polish / nice-to-have
```

## 4. Iteration protocol

For every issue:

1. reproduce;
2. identify root cause;
3. determine whether source-of-truth docs need clarification;
4. update the relevant spec if the discovered behavior changes the intended contract;
5. implement fix;
6. add regression coverage;
7. run targeted checks;
8. run relevant full suite;
9. deploy preview;
10. inspect;
11. merge/deploy production when verified.

## 5. Suggested agent prompts

### Initial implementation prompt

> Read all PASS source-of-truth documents. Build the entire PASS product in one implementation effort. Do not reduce scope by removing the Chrome extension, Hyperliquid execution, Ethos, X, analytics, or deployment. Implement all defined surfaces end-to-end. Use current official provider SDKs/documentation. Do not invent product behavior. Add tests as you go. Deploy a complete first version after local verification and report production URLs, test results, extension artifact, and known gaps.

### Iteration prompt

> Inspect the current deployed PASS version and the reported issue list. Reproduce each issue. Fix P0/P1 issues first. Preserve all source-of-truth contracts unless a documented decision change is required. Add regression tests for corrected behavior. Deploy a preview, verify the affected flow, then deploy production when stable. Report exactly what changed and any unresolved gaps.

## 6. Final build gate

The first implementation is complete only when:

- web app builds;
- API builds;
- database migrations apply;
- tests pass to the agreed threshold;
- extension builds and loads;
- public Pass links work;
- identity flows work or fail gracefully;
- Hyperliquid reads work;
- controlled Hyperliquid execution works;
- Ethos data works or fails gracefully;
- X sharing works through a supported path;
- production is deployed;
- smoke tests pass;
- known limitations are documented.
