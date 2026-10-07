# Stage K — build continuation

**Written:** 2026-10-06 (twelfth revision)

## Two-session deploy investigation: CLOSED

`NEXT_PUBLIC_API_URL` was **present all along**. The OG bug was a `"use client"`
module imported into a server context, plus me verifying a deploy before it had
finished serving. Hardened `apps/web/src/lib/api.ts` so a production build
without the variable throws rather than silently using localhost.

Verified served: `og:description` =
`BTC LONG · @turnttfup99 · Entry $113.4K • TP $116K • SL $111.9K`.
Take route 200. Gallery still 404.

**When you deploy, wait for the build before curling.** A 20-second wait was not
enough and cost a session.

## Screen inventory: 10 of 13 done

Done: §10.1 Landing · §10.2 Discover · §10.3 Pass detail · §10.4 Trader
profile · §10.5 Create Pass · §10.6 Take flow · §10.7 Stale · §10.12 Error/404 ·
§10.14 OG.

**Four still on the provisional Stage J UI — all return HTTP 200, so a status
check will NOT reveal that:**

| Screen | § | Route | Primitives needed on demand |
|---|---|---|---|
| My Passes (dashboard) | §10.8 | `/me/passes` | `DataTable`, `StatRow` |
| Executions | §10.9 | `/me/executions` | `PriceCell`, `PnlCell`, `DataCell`, `Tag` |
| Profile and connections | §10.10 | `/settings` | `Avatar`, `ConnectionChip` |
| Onboarding and connect | §10.11 | not yet routed | none beyond Wave 2 |

Then §10.13 extension overlay harmonisation (visual only — inline token values
into `apps/extension/src/content.css` with a comment citing each token; touch no
detection, injection, SPA, API, or message-protocol logic; **the operator must
reload the extension in Chrome**), then Tailwind removal (Wave 7).

## Operator verification checklist

1. **Open all four provisional routes in a browser** — they serve 200 with the
   old UI, so curl proves nothing.
2. `/passes/UvvuxpWPZ4/take` — step 1 size field must be EMPTY and the flow must
   not advance until consent is ticked.
3. Share a `/p/{publicId}` link on X — the card should now read
   `PASS / BTC LONG / @turnttfup99 / Entry $113.4K • TP $116K • SL $111.9K`.
4. Font paint: nine `document.fonts.check(...)` calls; Network → `fonts` nine
   `/fonts/*.woff2` all 200; **zoom 200% — a serif means a face did not resolve**.
5. Target sizes ≥44px (declared, never measured) · press state `scale(0.98)` ·
   focus ring in forced-colors · reduced motion.

## Standing constraints

- No browser automation. Nothing is visually verified. Phase stays open.
- No UI framework, component library, or animation library.
- **Build a primitive only when the screen in front of you needs it.**
- **Do not revert a complete screen over miscalibrated tests.**
- **Verify a deploy by reading it only after the build finishes.**
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
