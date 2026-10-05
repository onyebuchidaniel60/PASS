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
| 1 | Signature devices and framing | Not started |
| 2 | Actions and form controls | Not started |
| 3 | Data display | Not started |
| 4 | Identity, reputation, state blocks | Not started |
| 5 | Overlays and chrome | Not started |
| 6 | Extension surfaces | Not started |
| 7 | Screens | Not started |

| Screen | `DESIGN.md` § | Wave | Status |
|---|---|---|---|
| Landing | §10.1 | 7 | Not started |
| Discover / Explore Passes | §10.2 | 7 | Not started |
| Pass detail — the core conversion surface | §10.3 | 7 | Not started |
| Trader profile | §10.4 | 7 | Not started |
| Create Pass | §10.5 | 7 | Not started |
| Take flow (steps 1–4) | §10.6 | 7 | Not started |
| Stale Pass interstitial | §10.7 | 7 | Not started |
| My Passes (dashboard) | §10.8 | 7 | Not started |
| Executions | §10.9 | 7 | Not started |
| Profile and connections (own) | §10.10 | 7 | Not started |
| Onboarding and connect | §10.11 | 7 | Not started |
| Error and not-found | §10.12 | 7 | Not started |
| Social preview (Open Graph) | §10.14 | 7 | Not started |
| Extension surfaces (card, badge, popup) | §10.13 | 6 | Not started |
| Gallery (development route) | §10.15 | 1 | Not started |

**13 web screens + 1 extension surface set + 1 development gallery.** §10 is the
authoritative list; the Stage K brief's eleven-screen list is superseded and was
wrong in three ways — see G-16 below.

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

## Where to start

1. [`SKILL_FRONTEND_DESIGN.md`](../SKILL_FRONTEND_DESIGN.md) — the craft skill governing all frontend work. Read-only; it is authored elsewhere and is **not** to be edited.
2. [`AGENTS.md`](../AGENTS.md) — the agent rules, including the *UI and Frontend* section that binds this folder to the build.
3. [`docs/DECISIONS.md`](../docs/DECISIONS.md) — highest authority. D-016 and D-017 govern this track.
4. `DESIGN.md`, then `FRONTEND_IMPLEMENTATION_PLAN.md`, then the references.

## Editing rules

- `DESIGN.md` is amended deliberately and separately, with a stated reason, recorded as a phase deliverable. It is **never** edited to match a buggy implementation.
- A screen needing a visual decision `DESIGN.md` does not cover must **stop and record the gap** (see `DESIGN.md` §13). Visual language is never invented to fill a hole.
- The images in `references/` are read-only. Do not move, rename, crop, optimise, or re-encode them.