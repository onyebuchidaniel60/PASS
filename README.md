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

Source: `apps/extension/`

To build and load it:

1. Install dependencies and build:

   ```bash
   pnpm install
   pnpm --filter @pass/extension build
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable Developer mode (top right toggle).

4. Click "Load unpacked" and select the folder:

   ```text
   apps/extension/dist
   ```

5. Open x.com in a new tab. The extension overlay will appear on
   supported profile and post pages.

To rebuild after any source change:

```bash
pnpm --filter @pass/extension build
```

Then press Reload on the extension card in `chrome://extensions`.

The extension targets the deployed PASS API at
https://pass-pz7f.onrender.com

## Docs

Start with docs/ for the source of truth — docs/AI_HANDOFF.md for current state.

## Development

See docs/DEVELOPMENT.md for setup, environment, tests, and deployment.
The Chrome extension is optional — see "Chrome extension (optional)" above.
