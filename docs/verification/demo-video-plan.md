# PASS demo video plan (mock walk, under three minutes)

Shoot from the operator mock walk (Task 2): sign in, take, receipt,
executions. Keep the SIMULATED label in frame wherever it appears. Total
budget: under three minutes.

## Scene 1 — landing page (15 seconds)

One sentence on the product: "PASS turns a trader's Hyperliquid trade plan
into a shareable Pass another trader can take." Show the landing page.
No metrics, no traction claims.

## Scene 2 — sign in with X, onboarding (30 seconds)

Sign in with X. Walk the three onboarding steps (no wallet step — wallet
connects lazily at Take time). One line: "Identity is X; the wallet is
execution-only."

## Scene 3 — create a Pass, publish, copy the public URL (30 seconds)

Create a Pass (BTC, direction, limit entry, TP, SL, leverage, thesis).
Publish. Show the `/p/{publicId}` URL and copy it. One line: "The Pass is
a versioned trade plan, not a fund."

## Scene 4 — open the Pass signed-out in a fresh window (10 seconds)

Paste the URL in a signed-out window. Show the plan, the Trader, and the
Ethos context rendering with no session. One line: "Public artifacts
render for everyone."

## Scene 5 — back in the author window, Take the Pass (30 seconds)

Size 100. Review the preview — pause on the "This order will be
simulated. No funds will move." line and the chosen size, entry, TP, SL,
leverage. Authorize with consent. Approve the agent in the wallet popup.
Hold on the receipt: `mock_<uuid>` id in muted type with the demo tag,
"SIMULATED — no funds moved, no order sent to Hyperliquid," and the demo
execution explainer. Read the receipt aloud verbatim.

## Scene 6 — Executions page (10 seconds)

Show the top-of-list banner ("Some executions below are simulated for
demo purposes. They are labelled.") and the new row carrying its inline
SIMULATED label. Expand the row: provider order id and Pass version.

## Scene 7 — honest closing claim (10 seconds)

Voiceover, verbatim: "The full Take pipeline is built. Signing, relay,
and Hyperliquid's own validation are verified against mainnet. The fill
requires a funded account; that is the only remaining step."

## Do-not list (applies to every scene)

- Do not crop out the SIMULATED label, the demo tag, the preview
  simulation line, or the DemoBanner.
- Do not say or show anything implying funds moved, a position opened,
  or an order rested on Hyperliquid.
- Do not show keys, signatures, QR codes of secrets, or the Railway
  dashboard with env values.
