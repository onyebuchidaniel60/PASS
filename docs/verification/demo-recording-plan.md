# Demo recording plan (mock walk, one continuous take preferred)

Target: under 3 minutes. Record at 1280x800 or wider, browser chrome
visible, full page in frame. Narrate from
`docs/verification/demo-voiceover.md` — this file is camera and clicks only.

## Pre-flight (do not record)

1. Confirm `GET https://pass-api-production.up.railway.app/health` shows
   `hyperliquidExecution: "mock"` and `hyperliquidReads: "live"`. If
   execution is not mock, stop and revert before recording.
2. Re-check the camera Pass is still takable:
   `GET https://pass-api-production.up.railway.app/api/v1/discover?limit=5`
   must list it with `"status":"active"`. The reconciler flips Passes on
   price action; a flipped Pass loses its Take button mid-take.
3. Hard-reload the site (Ctrl+Shift+R). Close DevTools. Hide bookmarks bar
   clutter if it leaks personal entries.
4. Rabby: selected account `0x6946…08E0`, testnet. Only Rabby enabled.

## Scene 1 — landing (15s)

- URL: `https://pass-web-dun.vercel.app/`
- Do: slow scroll top → hero → loop strip. Nothing to click.

## Scene 2 — sign in with X (25s)

- Click: topbar "Sign in with X".
- Do: complete the X OAuth flow in the popup, land back on site. Do not
  narrate the OAuth form fields.

## Scene 3 — open the Pass (25s)

- URL: `https://pass-web-dun.vercel.app/p/vTuWfreJJd`
  (backup if flipped: `https://pass-web-dun.vercel.app/p/gEQmAUJ8rD` —
  if neither is active, stop; do not take a non-active Pass on camera).
- Do: scroll plan → levels → trader → Take CTA. Pause two beats on the
  fee disclosure line under the CTA.

## Scene 4 — Take (40s)

- Click: "Take Pass" → `/passes/vTuWfreJJd/take`.
- Do: type `100` in Position size, set leverage `2x`, "Review order".
  Pause two beats on the preview ("This order will be simulated. No
  funds will move.") and the restated numbers. "Authorize", tick the
  consent checkbox, "Authorize order".
- Wallet: approve the agent once in the Rabby popup. Check the account
  at the bottom of the popup reads `0x6946…08E0` before confirming. If
  it reads anything else, stop — do not sign.

## Scene 5 — receipt with simulated fees (35s)

- Do: hold the step-4 receipt full-frame for a slow count of five. Read
  it verbatim from the voiceover: `mock_<uuid>` id with demo tag,
  SIMULATED lines, then the four fee values. Scroll slowly if the fee
  block sits below the fold — never crop it out of frame.

## Scene 6 — My Passes with simulated fees earned (25s)

- URL: `https://pass-web-dun.vercel.app/me/passes`
- Do: point at the taken Pass's row and its "Fees earned (simulated)"
  line. End of take.

## Do not show (applies to every scene)

- No DevTools, no terminal, no editor, no Railway/Vercel dashboards.
- No seed phrases, no wallet private keys, no agent private key, no
  `window.ethereum` console poking, no QR codes of secrets.
- Never crop the SIMULATED label, the demo tag, the preview simulation
  line, the fee block, or the "no real fees are charged" line.
- Do not say or show anything implying funds moved, a position opened,
  fees were really charged, or an order rested on Hyperliquid.
- Do not take a Pass whose status is not `active`. Do not re-take on
  camera if the first Take succeeded — one Take, one receipt.
