# Stage K — build continuation

**Written:** 2026-10-06 (eleventh revision)

## Status of the two items that were open

| Item | Result |
|---|---|
| Take route 404 in production | **FIXED and verified: 200, serves the Take flow** |
| Pass OG metadata | **STILL SERVING THE FALLBACK.** Unit tests pass; the deployed `og:description` is the generic text. Likely a build-time `NEXT_PUBLIC_API_URL` that falls back to `http://127.0.0.1:4000` in `apps/web/src/lib/api.ts`. Not claimed as fixed. |

The take-route 404 was **two code defects plus a stale Vercel build cache**. The
cache was only cleared by `vercel --prod --force`; the CLI had reported
"Restored build cache from previous deployment", which served the old build.

## Screen inventory: 10 of 13 done

Done: §10.1 Landing · §10.2 Discover · §10.3 Pass detail · §10.4 Trader
profile · §10.5 Create Pass · §10.6 Take flow · §10.7 Stale · §10.12 Error/404 ·
§10.14 OG.

**Still provisional — three screens:**

| Screen | § | Route | Primitives needed on demand |
|---|---|---|---|
| My Passes (dashboard) | §10.8 | `/me/passes` | `DataTable`, `StatRow` |
| Executions | §10.9 | `/me/executions` | `PriceCell`, `PnlCell`, `DataCell`, `Tag` |
| Profile and connections | §10.10 | `/settings` | `Avatar`, `ConnectionChip` |

**§10.10 Profile and connections is NOT omitted** — it is listed above and is
one of the three remaining screens. §10.11 Onboarding has no route and is
also outstanding; count it as a fourth if time allows.

## Exact next step

**1. My Passes (§10.8).** Authenticated; reuse the `/api/v1/me` check from Create
   Pass for the permission state. Lifecycle summary strip of `StatBlock`s, then
   a `DataTable` of owned Passes with status chips. §10.8: draft and cancelled
   rows take a ghost treatment, never reduced opacity on text, which would break
   contrast.

**2. Executions (§10.9).** `GET /api/v1/me/executions`. Row detail reveals the
   provider order id and the referenced Pass version (PRD §15 reconstructability).
   Period control is a `SegmentedControl` stored as an **offset from now**, never
   a frozen date (§10.9, skill §9 rule 2). Verify the PnL sign convention against
   the API before rendering.

**3. Profile and connections (§10.10).** Render exactly what the design
   specifies — no invented fields. Connection state per provider with its own
   connect/reconnect action. **No field may display or request a seed phrase or
   master private key** (§10.10, `AGENTS.md`).

**4. Onboarding (§10.11).** One step per screen, progress as mono `STEP 2 / 4`.
   `UnavailableBlock` for a provider that cannot be reached.

**5. OG metadata.** Confirm whether `NEXT_PUBLIC_API_URL` is set in the Vercel
   **build** environment, or whether `generateMetadata` should read a
   server-only variable.

**6. Then** §10.13 extension overlay harmonisation — visual only; inline the
   token values into `apps/extension/src/content.css` with a comment citing each
   token. Touch no detection, injection, SPA, API, or message-protocol logic.
   **The operator must reload the extension in Chrome afterwards.**

**7. Tailwind removal (Wave 7).** Check first:
   `grep -r "className=" apps/web/src | grep -v "pass-"`.
   If only `/me/passes`, `/me/executions` and `/settings` still use utilities,
   **do not remove it**; record the count and leave it.

## Operator verification checklist

1. **Reload the Chrome extension** if the overlay is harmonised.
2. **Open `/passes/UvvuxpWPZ4/take` in a browser** and confirm step 1 renders:
   the size field must be EMPTY, and the flow must refuse to advance until
   consent is ticked.
3. Open `/`, `/discover`, `/p/UvvuxpWPZ4`, `/u/turnttfup99`, `/passes/new`,
   `/passes/UvvuxpWPZ4/stale`. All are client-fetched, so served HTML shows only
   a loading state — they must be checked in a browser, not with curl.
4. Share a `/p/{publicId}` link on X. **The card is currently expected to show
   the fallback text, not the spec line** — see the OG item above.
5. Font paint: nine `document.fonts.check(...)` calls; Network → `fonts` nine
   `/fonts/*.woff2` all 200; **zoom 200% on a heading — a serif means a face did
   not resolve**.
6. Target sizes ≥44px (declared, never measured) · press state `scale(0.98)` ·
   focus ring in forced-colors.
7. Reduced motion — nothing moves; signal line final-state.

## Standing constraints

- No browser automation. Nothing is visually verified. Phase stays open.
- No UI framework, component library, or animation library. Testing tools only.
- Tailwind until Wave 7, and only removable once no screen uses utilities.
- **Build a primitive only when the screen in front of you needs it.**
- **Verify deploys by reading the deployed artifact.** Two sessions were lost to
  a stale Vercel build cache while a correct fix appeared not to work. Use
  `vercel --prod --force` and curl the route.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
