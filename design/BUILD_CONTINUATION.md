# Stage K — build continuation

**Written:** 2026-10-07 (thirteenth revision — Stage K build complete)

**Next step is no longer a code step.** Every wave, every screen, and the token
ratchet are landed and deployed. What remains is the operator pass in §4: this
environment has no browser automation, so nothing in this track can be called
verified from here. Read §4 and run it.

## 1. What this session closed

**Token ratchet: clean.** 28 untolerated violations, all mechanical, all fixed:

| File | Violations | Fix |
|---|---|---|
| `components/wave3/table.tsx` | 17 | Every inline `style={{...}}` moved to a `.pass-table-*` / `.pass-stat-row` class. Also removed three *undefined* CSS variables that were silently doing nothing: `var(--rule)`, `var(--surface-sunken)`, `var(--ink-faint)` — none of them exists in the token layer. |
| `components/wave3/identity.tsx` | 6 | `Avatar` and `ConnectionChip` inline style objects moved to `.pass-avatar[data-size]` and `.pass-connection*` classes. |
| `app/me/executions/ExecutionsClient.tsx` | 4 | Row cells moved to `.pass-table-cell` with `data-align`. |
| `styles/components.css` | 3 | `.pass-tag` off-scale `2px 6px` and a raw `1px solid` border → `var(--space-1) var(--space-2)` and `var(--border-hairline)`. |

Four tokens added to `tokens.css`, all genuinely missing:

- `--size-avatar-sm|md|lg` — an avatar has no relation to the §7.1 icon grid.
- `--size-connection-min` — the connection chip's label block minimum inline size.

**Ratchet map emptied.** All four `PENDING_MIGRATION` allowances were stale: the
four Wave 7 screens they covered are thin server shells now and hold **zero**
violations. Deleting an entry is part of rebuilding the screen it names, so the
map is now empty. The allowance machinery stays; a future provisional screen may
need it.

**Two latent CSS bugs fixed as a side effect of the above** — worth recording
because the ratchet would never have caught either:

1. `<caption className="sr-only">` — no `.sr-only` rule exists in the layer
   (`.visually-hidden` is the one that exists), so the table caption was
   rendering **visibly** above both inventory tables.
2. `var(--rule)` is not a token. Every `borderBottom: "1px solid var(--rule)"`
   in `table.tsx` resolved to nothing, so **no row rule was drawing at all**.
   Same for `var(--surface-sunken)` on ghost rows and `var(--ink-faint)` on the
   stacked labels. The ghost-row rule in `components.css` was correct; the
   inline duplicates were dead code contradicting it.

**Test clock.** `apps/web/vitest.config.ts` had vitest's 5s default timeout
while the root config uses 30s/60s. Five DOM tests failed on machine speed, not
behaviour. Widened to match the root config; **no assertion was relaxed**.

## 2. Wave status

| Wave | Deliverable | Status |
|---|---|---|
| 0 | Token layer, fonts, base styles, token scan, contrast | Built, not visually verified |
| 1 | Signature devices and framing | Built, not visually verified |
| 2 | Actions and form controls | Built, not visually verified |
| 3 | Data display | Built, not visually verified |
| 4 | Identity, reputation, state blocks | Built, not visually verified |
| 5 | Overlays and chrome | Built, not visually verified |
| 6 | Extension surfaces (§10.13 harmonisation) | Built, **operator must reload the extension in Chrome** |
| 7 | Screens | Built, deployed, not visually verified |

**No wave holds "Done".** Per plan §1 and `SKILL_FRONTEND_DESIGN.md` §7.6, a
screen is done when it has been rendered, opened, used as a user, measured, and
compared against `design/DESIGN.md`. None has.

## 3. Screen status — 13 of 13 built

All thirteen `DESIGN.md` §10 web screens are built. All are deployed at
`https://pass-web-dun.vercel.app`.

| Screen | § | Route | Verified by curl? |
|---|---|---|---|
| Landing | §10.1 | `/` | reachability only |
| Discover | §10.2 | `/discover` | reachability only |
| Pass detail | §10.3 | `/p/[publicId]` | reachability only |
| Trader profile | §10.4 | `/u/[slug]` | reachability only |
| Create Pass | §10.5 | `/passes/new` | reachability only |
| Take flow | §10.6 | `/passes/[publicId]/take` | reachability only |
| Stale Pass | §10.7 | `/passes/[publicId]/stale` | reachability only |
| My Passes | §10.8 | `/me/passes` | **200** |
| Executions | §10.9 | `/me/executions` | **200** |
| Profile and connections | §10.10 | `/settings` | **200** |
| Onboarding and connect | §10.11 | `/onboarding` | **200** |
| Error and not-found | §10.12 | `error.tsx` / `not-found.tsx` | reachability only |
| Social preview (OG) | §10.14 | `/p/[publicId]` metadata | card text confirmed last session |

**A 200 proves nothing about the screen.** The four provisional routes returned
200 with the old UI for two sessions. Route status is reachability; every screen
above still needs a human to look at it.

### Extension overlay — §10.13

Harmonized onto the token palette in `apps/extension/src/content.css` (token
values inlined with a comment citing each one). **Visual only** — no detection,
injection, SPA, API, or message-protocol logic was touched. The operator must
**reload the extension in `chrome://extensions`** or the old stylesheet keeps
serving.

## 4. Operator verification checklist — nothing here is done

Run against the deployed URL unless noted.

1. **All thirteen screens, opened, at 375 / 768 / 1280 / 1440.** Every screen in
   §3. Note anything that does not match `DESIGN.md` — do not fix it in code
   first; record it.
2. **Font paint.** Console, nine `document.fonts.check(...)` calls (full list in
   [phase-records/PHASE_00_tokens.md](./phase-records/PHASE_00_tokens.md) §8.5);
   Network filtered to `fonts`, nine `/fonts/*.woff2`, all **200**, no
   third-party origin; **zoom a heading to 200% — a serif means a face did not
   resolve** and no test fails when that happens.
3. **Target sizes ≥ 44px.** Declared via `--size-target-min`, never measured.
4. **Press state `scale(0.98)`, focus ring visible in `forced-colors` mode,
   `prefers-reduced-motion` honoured.**
5. **Take flow.** `/passes/UvvuxpWPZ4/take` — step 1's size field must be EMPTY
   and the flow must not advance until consent is ticked.
6. **Executions table.** No horizontal scroller at any width; below 720px it must
   become a stacked list (this was the standing `D-1` anti-pattern — confirm it
   is actually gone, not just that the route is 200).
7. **X share card.** Share a `/p/{publicId}` link; the card should read
   `PASS / BTC LONG / @turnttfup99 / Entry $113.4K • TP $116K • SL $111.9K`.
8. **Extension.** Reload in `chrome://extensions`, then check the overlay, badge,
   and popup against `DESIGN.md` §10.13.
9. **Gallery.** `/gallery` returns **404** in production — this is correct and
   deliberate (it is a development route, gated off by `NODE_ENV`). To inspect
   it, run `pnpm --filter @pass/web dev` and open it locally.
10. **Topbar connect button.** `@pass/ui` Button and `DemoBanner` are still
    Tailwind. Confirm they render styled — see §5.

## 5. Tailwind — retained, deliberately

**Status: RETAINED.** `apps/web/src` is now **completely free of Tailwind
utility classes** — a grep for `className=` in `apps/web/src` returns zero
utility patterns. The last six were migrated this session
(`ApproveAgentControl.tsx`, `ShareControl.tsx` → `.pass-note`,
`.pass-note-status`, and the `Stack`/`Inline` primitives).

Tailwind itself stays because two consumers are not ours to rewrite here:

1. **`packages/ui`** — the provisional Stage K primitives (`Button`,
   `DemoBanner`, and eleven others) are ~37 Tailwind class strings, and the root
   layout renders `DemoBanner` on every page.
2. **`connectkit`'s `ConnectKitButton`** — its own rendered markup is Tailwind
   utility classes, and it renders in the topbar on every page.

**Removing `tailwindcss` would not fail the build.** It would silently strip the
connect button and the demo banner of every style. That is precisely the failure
mode a green CI run cannot catch, so `tailwindcss`, `postcss`, and `autoprefixer`
remain until `@pass/ui` is migrated onto the token layer. The reason is written
into `globals.css` next to the `@tailwind` directives so it is not rediscovered
as an oversight.

## 6. Design gaps G-1 – G-16

| Gap | Subject | Status |
|---|---|---|
| G-1 | Light-mode token values | **Open, decided-out.** Dark-only is §2.7; no light palette derived. |
| G-2 | Wordmark / logo mark | **Open and binding.** No logo may be drawn or improvised; the wordmark ships as type only. |
| G-3 | Chart and PnL-curve styling | **Open, decided-out.** Charting is a PRD §5 non-goal. |
| G-4 | `ReputationBlock` collapse on mobile | **Open.** Needs a measured mobile density — i.e. a browser. |
| G-5 | Empty-state illustration language | **Open, decided-out.** §12.2 forbids illustration. |
| G-6 | Avatar fallback beyond the monogram | **Open, narrowed.** `Avatar` now has a declared reticle fallback. Any *other* fallback art is still forbidden. |
| G-7 | Behaviour at large OS font-scale | **Open.** Never tested; cannot be from here. |
| G-8 | Modal vs bottom sheet on tablet | **Open.** Needs measured one-handed reach. |
| G-9 | Print stylesheet | **Open, decided-out.** Out of scope. |
| G-10 | Notification / alert surfaces | **Open, decided-out.** Not in MVP scope. |
| G-11 | Exact icon set and licence | **Open.** Glyph names specified in §7.2; the source is not chosen. |
| G-12 | Localisation beyond UTC | **Open, decided-out.** MVP is English + UTC. |
| G-13 | `SignalLine` sweep beyond the hero | **Open, decided-out.** §6.4 limits it. |
| G-14 | Token layer file path | **Closed** — bound to `apps/web/src/styles/tokens.css`. |
| G-15 | Input border contrast | **Closed 2026-10-06** — `#656577`, 3.33:1, asserted by the contrast check. |
| G-16 | Screen inventory vs the brief | **Closed 2026-10-06** — 13 web screens derived from §10. |

Twelve of the sixteen are *decided-out* rather than pending: `DESIGN.md` names
them and says do not build them. Only **G-4, G-6, G-7, G-8 and G-11** are
genuinely unresolved, and every one of them needs a browser or an operator
decision.

## 7. Standing constraints

- No browser automation. Nothing is visually verified. Stage K stays open.
- No UI framework, component library, or animation library.
- **Build a primitive only when the screen in front of you needs it.**
- **Do not revert a complete screen over miscalibrated tests.**
- **Wait for a deploy build to finish before curling it.** A 20-second wait was
  not enough and cost a session.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only
  as a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
- `NEXT_PUBLIC_API_URL` must be set to build locally; `apps/web/src/lib/api.ts`
  throws rather than falling back to localhost.
