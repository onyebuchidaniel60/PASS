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

## Where to start

1. [`SKILL_FRONTEND_DESIGN.md`](../SKILL_FRONTEND_DESIGN.md) — the craft skill governing all frontend work. Read-only; it is authored elsewhere and is **not** to be edited.
2. [`AGENTS.md`](../AGENTS.md) — the agent rules, including the *UI and Frontend* section that binds this folder to the build.
3. [`docs/DECISIONS.md`](../docs/DECISIONS.md) — highest authority. D-016 and D-017 govern this track.
4. `DESIGN.md`, then `FRONTEND_IMPLEMENTATION_PLAN.md`, then the references.

## Editing rules

- `DESIGN.md` is amended deliberately and separately, with a stated reason, recorded as a phase deliverable. It is **never** edited to match a buggy implementation.
- A screen needing a visual decision `DESIGN.md` does not cover must **stop and record the gap** (see `DESIGN.md` §13). Visual language is never invented to fill a hole.
- The images in `references/` are read-only. Do not move, rename, crop, optimise, or re-encode them.