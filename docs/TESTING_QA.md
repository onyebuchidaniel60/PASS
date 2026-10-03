# PASS — Testing & QA Specification

## 1. Testing strategy

The first build must be complete, then verified by a layered testing strategy.

```text
Static checks
  -> Unit tests
  -> Integration tests
  -> API contract tests
  -> Extension tests
  -> End-to-end tests
  -> Production smoke test
  -> Manual UX review
```

## 2. Unit tests

Cover pure domain logic:

- Pass validation;
- direction/TP/SL consistency;
- leverage validation;
- expiry handling;
- state-machine transitions;
- R-multiple calculations;
- position-size calculations;
- idempotency decisions;
- metric aggregation.

## 3. Integration tests

Mock or fixture external providers.

Cover:

- Hyperliquid market metadata parsing;
- Hyperliquid account data normalization;
- order request construction;
- provider error mapping;
- Ethos identity/reputation parsing;
- X identity response parsing;
- X post response parsing.

## 4. Contract tests

Validate that API DTOs remain compatible between web and backend.

Check every execution request against the same Zod/schema used by the backend.

## 5. Security tests

At minimum:

- unauthorized Pass mutation;
- unauthorized execution for another account;
- stale Pass version rejection;
- duplicate execution request;
- invalid nonce/expired signed action;
- OAuth state mismatch;
- CSRF on mutations;
- XSS attempts through usernames/thesis text;
- malicious Pass URLs;
- extension injection safety.

## 6. Hyperliquid execution tests

Use test/sandbox capabilities where available and never use a real funded account during automated tests.

Test:

1. market selection;
2. limit order construction;
3. invalid order;
4. insufficient margin;
5. stale Pass;
6. slippage breach;
7. provider timeout;
8. duplicate submission;
9. order status reconciliation;
10. cancel/retry behavior.

## 7. Pass lifecycle tests

Expected transitions must be explicit.

Examples:

```text
DRAFT -> ACTIVE
ACTIVE -> ENTRY_PENDING
ENTRY_PENDING -> OPEN
OPEN -> TP_HIT
OPEN -> SL_HIT
OPEN -> MANUALLY_CLOSED
ACTIVE -> EXPIRED
ACTIVE -> CANCELLED
```

Invalid transitions must fail deterministically.

## 8. Extension tests

Automate where practical and complement with manual Chrome testing.

The extension must not:

- block page interaction;
- throw unhandled errors on normal X navigation;
- produce duplicate cards from repeated mutations;
- leak provider credentials into page context;
- inject unsafe HTML.

## 9. End-to-end golden path

### Golden path A — Trader

```text
create account
-> connect X
-> create profile
-> resolve Ethos
-> associate Hyperliquid account
-> create Pass
-> publish Pass
-> copy/share URL
```

### Golden path B — Taker

```text
open public Pass
-> inspect Trader
-> inspect Ethos
-> inspect Pass
-> choose position size
-> preview
-> authorize agent if first time
-> sign order
-> submit to Hyperliquid
-> see execution
```

### Golden path C — Extension

```text
open X
-> extension detects Trader/post
-> PASS card appears
-> click View Pass
-> PASS page opens
-> normal Take flow
```

## 10. Production smoke tests

After every meaningful production deployment:

- home page loads;
- public Pass page loads;
- API health endpoint succeeds;
- database connectivity works;
- X identity path works in configured environment;
- Ethos lookup works/fails gracefully;
- Hyperliquid read endpoint works;
- extension build artifact exists;
- at least one safe execution test path is verified.

## 11. UX acceptance review

Manually review:

- desktop 1440px;
- laptop 1280px;
- mobile 390px;
- slow network;
- first-time user;
- returning user;
- failed transaction;
- expired Pass;
- updated Pass;
- no Ethos data;
- no X connection;
- no active Passes.

## 12. Quality gate

Do not call a release complete if:

- critical path is broken;
- private key material is exposed;
- execution can duplicate unintentionally;
- historical Pass data can be silently rewritten;
- public pages reveal private account information;
- extension crashes normal X navigation.
