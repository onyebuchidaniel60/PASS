# PASS — Colosseum Crypto World's Fair Submission Notes

**Verified:** 2026-10-03

## 1. Event

Colosseum's Crypto World's Fair is an online hackathon open across blockchain ecosystems.

Current event page:

https://colosseum.com/worldsfair

Current stated submission deadline: **October 12, 2026**.

Current event page advertises **$840,000 in prizes** and **$2.5 million in seed funding** through the accelerator opportunity.

## 2. Position PASS for the submission

Project name:

**PASS**

One-line description:

> Turn a trader's Hyperliquid trade plan into a shareable, executable Pass.

Long description:

> PASS is a social execution layer for Hyperliquid. Traders turn their trade plans into shareable Passes that people discover through X, inspect alongside the Trader's identity and Ethos reputation, and independently execute on Hyperliquid with their own chosen position size.

## 3. Why Hyperliquid is fundamental

Hyperliquid is not just a backend checkbox. PASS is designed around Hyperliquid's trading data, order execution, and API-wallet/agent signing model.

The submission demo should demonstrate a real Hyperliquid trade flow where feasible.

## 4. Demo story

```text
X post
  -> PASS link
  -> Trader profile
  -> Ethos context
  -> Trade plan
  -> Take Pass
  -> Hyperliquid authorization
  -> Order
  -> Execution confirmation
```

The demo walk is the mock walk: every step above runs for real except the
venue submission, which is simulated and shown with a SIMULATED label on
the receipt and on the Executions page. The video keeps the label visible
throughout — the honesty of the label is part of the demo.

## 5. Demo discipline

Do not spend the pitch explaining every feature.

Demonstrate the unique primitive:

> a specific trade becomes a portable social object that can be independently executed.

## 6. Extension story

The Chrome extension demonstrates that PASS can move beyond a standalone website and become embedded in the discovery surface where traders already consume trading content.

## 7. Claims discipline

Use verified metrics only.

Do not fabricate traction, users, volume, performance, or reputation.

Do not imply guaranteed returns.

### Verification status (2026-10-11)

Proven:

- Order signing: the client's L1 order signature is parsed by Hyperliquid
  mainnet and the signer is recovered (direct dry run reaches HL's
  account lookup — see `docs/verification/hl-signature-2026-10-11.txt`).
- Order schema: the bracket action built by `buildOrderAction`
  (entry + reduce-only TP/SL, `grouping: "normalTpsl"`) is accepted by
  Hyperliquid's validation past signature recovery.
- Server relay: the signed payload travels client → PASS API → Hyperliquid
  Exchange API unchanged (D-018.3), validated in mock with `mock_<uuid>`
  receipts and idempotent `clientRequestId` handling.
- Hyperliquid reachability: live Info API reads (mids, books, account
  state) and live Exchange API responses verified from this codebase.
- Account lookup: Hyperliquid resolves the recovered signer against its
  account/agent records.

Not proven (requires a funded Hyperliquid account):

- The fill: no order has rested on or matched against the live book.
- The position: nothing has been opened on Hyperliquid.
- The TP/SL legs: the bracket exits have never triggered live.

The submission claim is therefore: PASS executes the full Take pipeline
up to Hyperliquid's own balance check; the fill is the only remaining
step and it needs a funded account. Nothing in the demo implies funds
moved — simulated executions are labelled SIMULATED in the UI, the
database (`executions.simulated`), and these docs.

## 8. Submission assets checklist

- project name;
- one-line description;
- project description;
- blockchain/ecosystem selection;
- GitHub repository;
- live demo URL;
- demo video (mock walk, simulated execution clearly labelled);
- pitch video if required;
- logo/graphic;
- team/background information;
- location;
- go-to-market/demand validation narrative;
- disclosure of pre-existing code where required.

## 9. Narrative

Problem:

Trading ideas are social, but execution is disconnected from the specific plan and context behind the person sharing it.

Solution:

PASS turns the plan into a shareable object that carries the trader's identity, reputation context, execution parameters, and lifecycle.

Differentiation:

PASS does not automatically copy a trader. A Taker chooses a specific Pass and independently executes it.

## 10. Source

Colosseum event details should always be rechecked against the live official event page immediately before submission.
