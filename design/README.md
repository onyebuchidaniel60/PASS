# PASS — Frontend Design Folder

This folder holds the frontend design track for PASS: the visual blueprint, the build plan, and the operator-placed visual references they were authored against.

It contains **no application code and no product behaviour**. Product behaviour is defined in `docs/` — this folder only defines how PASS looks, feels, and is built on the frontend.

## The three companion assets

`SKILL_FRONTEND_DESIGN.md` §13 requires three companion assets before any frontend work begins. All three live here:

| Asset | Path | What it is |
|---|---|---|
| Design document | [`DESIGN.md`](./DESIGN.md) | The visual and interaction blueprint. Colour, type, spacing, motion, components, per-screen direction, data-display rules, anti-patterns, and the list of things it deliberately does not specify. It wins on every visual conflict. |
| Frontend implementation plan | [`FRONTEND_IMPLEMENTATION_PLAN.md`](./FRONTEND_IMPLEMENTATION_PLAN.md) | Build order and verification protocol: reading order, the single token layer and its mechanical enforcement check, component-first waves, the per-screen delivery contract, motion helper boundaries, the deployment and secret-scan gate, the agent-as-user protocol, and phase records. |
| Visual references | [`references/`](./references/) | Operator-placed images. Direction, not specification — see [`references/SOURCES.md`](./references/SOURCES.md) for what each one is a reference for. |

## When this work happens

Frontend design and build begin **after** the one-shot build, as part of iteration.

Per [`docs/DECISIONS.md`](../docs/DECISIONS.md) **D-017**, the frontend design track is not part of the one-shot build. The one-shot build (Stages A–J of [`docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md)) delivers functional surfaces with a usable but provisional UI. This folder's work is **Stage K**, which begins only once Stage J verification is signed off.

Stage K's outputs — the screens, the components, and the design system tokens — are the deliverable of Stage K, not of Stage J.

## Stage K completion status

Status of each wave and screen against
[`FRONTEND_IMPLEMENTATION_PLAN.md`](./FRONTEND_IMPLEMENTATION_PLAN.md) §3.

**Verification status vocabulary:**

- **Built** — components exist and pass their wave gate.
- **Built, not visually verified** — built and typechecked, but **never opened
  in a browser**, because this environment has no browser automation. Cannot be
  called done. See [`phase-records/PHASE_00_tokens.md`](./phase-records/PHASE_00_tokens.md) §1.
- **Done** — built, deployed, agent-as-user pass completed with a clean second
  pass. **No screen in this track holds this status.**

| Wave | Deliverable | Status |
|---|---|---|
| 0 | Token layer, font loading, base styles, token scan, contrast measurement | **Built, not visually verified.** Open: font loading still needs verification by rendered pixels. |
| 1 | Signature devices and framing, plus the §10.15 gallery route | **Built, not visually verified.** |
| 2 | Actions and form controls | **Built, not visually verified.** |
| 3 | Data display | **Built, not visually verified.** |
| 4 | Identity, reputation, state blocks | **Built, not visually verified.** |
| 5 | Overlays and chrome | **Built, not visually verified.** |
| 6 | Extension surfaces (§10.13) | **Built.** The operator must reload the extension in `chrome://extensions` or the old stylesheet keeps serving. |
| 7 | Screens | **Built and deployed**, not visually verified. |

**The token ratchet is clean.** `pnpm run check:tokens` reports
`clean: no out-of-token values found` across all 73 scanned files, and the
per-file `PENDING_MIGRATION` allowance map in `scripts/check-design-tokens.mjs`
is now **empty** — every entry it held covered a screen that Wave 7 has since
rebuilt back to zero violations. The ratchet itself was not relaxed.

| Screen | `DESIGN.md` § | Wave | Status |
|---|---|---|---|
| Landing | §10.1 | 7 | Built, deployed, not visually verified |
| Discover / Explore Passes | §10.2 | 7 | Built, deployed, not visually verified |
| Pass detail — the core conversion surface | §10.3 | 7 | Built, deployed, not visually verified |
| Trader profile | §10.4 | 7 | Built, deployed, not visually verified |
| Create Pass | §10.5 | 7 | Built, deployed, not visually verified |
| Take flow (steps 1–4) | §10.6 | 7 | Built, deployed, not visually verified |
| Stale Pass interstitial | §10.7 | 7 | Built, deployed, not visually verified |
| My Passes (dashboard) | §10.8 | 7 | Built, deployed, not visually verified |
| Executions | §10.9 | 7 | Built, deployed, not visually verified |
| Profile and connections (own) | §10.10 | 7 | Built, deployed, not visually verified |
| Onboarding and connect | §10.11 | 7 | Built, deployed, not visually verified |
| Error and not-found | §10.12 | 7 | Built, deployed, not visually verified |
| Social preview (Open Graph) | §10.14 | 7 | Built, deployed; card text confirmed served |
| Extension surfaces (card, badge, popup) | §10.13 | 6 | Built; **operator must reload the extension** |
| Gallery (development route) | §10.15 | 1 | Built; intentionally **404 in production** (`NODE_ENV` gated) |

**13 web screens + 1 extension surface set + 1 development gallery.** §10 is the
authoritative list; the Stage K brief's eleven-screen list is superseded and was
wrong in three ways — see G-16 below.

**"Not visually verified" is not a formality.** Two sessions produced four
routes that returned HTTP 200 while still serving the *old* UI. A status code is
a reachability probe. The full operator checklist is
[`BUILD_CONTINUATION.md`](./BUILD_CONTINUATION.md) §4.

### Tailwind — retained, and `apps/web/src` no longer needs it

`apps/web/src` contains **zero** Tailwind utility classes. `tailwindcss`,
`postcss`, and `autoprefixer` remain as dev dependencies because two consumers
are not ours to rewrite: the provisional Stage K primitives in `packages/ui`
(~37 utility strings, `Button` and `DemoBanner` rendered by the root layout),
and `connectkit`'s `ConnectKitButton`, whose own rendered markup is Tailwind
classes. Removing the package would **not fail the build** — it would silently
strip both of those of every style, which is exactly the failure a green CI run
cannot catch. The reason is written next to the `@tailwind` directives in
`apps/web/src/app/globals.css`.

### G-16 — the brief's screen list was superseded by §10

Resolved 2026-10-06. `design/DESIGN.md` §10 is the screen contract, and it is
consistent with `docs/UX_SPEC.md` §3, which names four global destinations
(`Discover · My Passes · Executions · Profile`) and no Dashboard.

- The brief split **"Dashboard"** and **"My Passes"** into two screens. §10.8
  defines **one** screen, "My Passes (dashboard)". There is no separate Dashboard
  and none was invented. The build confirms this: there is no `/me` route, only
  `/me/passes` and `/me/executions`.
- The brief **omitted** four subsections the design document requires: §10.7
  Stale Pass interstitial, §10.11 Onboarding and connect, §10.12 Error and
  not-found, and §10.14 Social preview.
- The brief counted **§10.13** extension surfaces as a screen item while
  **omitting §10.15** Gallery, which is §10's own verification surface and is
  built in Wave 1 rather than Wave 7.

`design/FRONTEND_IMPLEMENTATION_PLAN.md` §3 Wave 7 independently lists the same
13 web screens, so the plan and the design document agree and the brief was the
outlier.

### G-15 — closed 2026-10-06

`--color-line-strong` measured 1.37:1 on `--color-surface` as the input border,
failing the 3:1 UI-boundary minimum. DESIGN.md §2.3 and §5.3 amended to
`#656577` (3.33:1); derivation and four-surface measurement in §5.3.1. The value
is now asserted by `scripts/check-contrast.mjs`, so a regression fails the
build.

### G-1 – G-16 status at Stage K build completion

Full table with dispositions is in
[`BUILD_CONTINUATION.md`](./BUILD_CONTINUATION.md) §6. Summary:

- **Closed:** G-14 (token layer path bound), G-15 (input border contrast),
  G-16 (screen inventory derived from §10).
- **Decided out** — `DESIGN.md` names the gap and says do not build it:
  G-1, G-3, G-5, G-9, G-10, G-12, G-13.
- **Binding and open** — G-2, no logo may be drawn or improvised.
- **Genuinely unresolved, every one needing a browser or an operator:**
  G-4 (`ReputationBlock` on mobile), G-6 (avatar fallback beyond the monogram —
  narrowed this session, the declared reticle is now the only fallback),
  G-7 (large OS font-scale behaviour), G-8 (modal vs bottom sheet on tablet),
  G-11 (icon set and licence).

## Deployed

`https://pass-web-dun.vercel.app`. Reachability confirmed at Stage K build
completion: `/me/passes` 200, `/me/executions` 200, `/settings` 200,
`/onboarding` 200, `/gallery` **404** (correct — the gallery is a
`NODE_ENV`-gated development route).

## Where to start

1. [`SKILL_FRONTEND_DESIGN.md`](../SKILL_FRONTEND_DESIGN.md) — the craft skill governing all frontend work. Read-only; it is authored elsewhere and is **not** to be edited.
2. [`AGENTS.md`](../AGENTS.md) — the agent rules, including the *UI and Frontend* section that binds this folder to the build.
3. [`docs/DECISIONS.md`](../docs/DECISIONS.md) — highest authority. D-016 and D-017 govern this track.
4. `DESIGN.md`, then `FRONTEND_IMPLEMENTATION_PLAN.md`, then the references.

## Editing rules

- `DESIGN.md` is amended deliberately and separately, with a stated reason, recorded as a phase deliverable. It is **never** edited to match a buggy implementation.
- A screen needing a visual decision `DESIGN.md` does not cover must **stop and record the gap** (see `DESIGN.md` §13). Visual language is never invented to fill a hole.
- The images in `references/` are read-only. Do not move, rename, crop, optimise, or re-encode them.