# PASS — Frontend Implementation Plan

**Status:** Build order and verification protocol for the PASS frontend.
**Executes:** `design/DESIGN.md`.
**Governed by:** `SKILL_FRONTEND_DESIGN.md` at the repository root.
**Sequencing:** Stage K of `docs/IMPLEMENTATION_PLAN.md`, **after** the one-shot build, per `docs/DECISIONS.md` D-017.

---

## 0. When this plan runs

> **This plan is executed after the one-shot build, as part of iteration, per `docs/DECISIONS.md` D-017. It is not part of the one-shot build.**

The one-shot build (Stages A–J) delivers functional surfaces with a usable but **provisional** UI. Stage K begins only after **Stage J verification is signed off** — the deployed product is usable end-to-end and the Stage J stop/verify gate has passed.

Stage K's outputs — the screens, the components, and the design system tokens — are the deliverable of **Stage K**, not of Stage J. Stage J is not re-scoped to include them, and its gate is not weakened to accommodate them.

This plan assumes the one-shot build has already produced:

- a deployed web frontend URL on Vercel;
- a deployed backend/API and database;
- working Pass, Trader, Take, and execution flows against those deployments;
- a working workspace with lint, typecheck, test, and a single `check` script;
- an extension build pipeline.

Where this plan names a path or script that depends on that workspace layout, it is marked **provisional** and must be reconciled against reality in the first hour of Stage K. A provisional path is a binding decision to make, not a licence to invent design.

### 0.1 Record capability first (skill §13.4)

Before the first component, record in the Stage K phase record:

1. Does the agent have browser automation in this environment? **Yes / No.**
2. Does it have a device target? PASS has **no** native mobile app in the MVP (PRD §5), so the device surface is the Chrome extension loaded unpacked in a real Chrome profile.
3. Where does that capability live, and how is it invoked?

If there is **no** browser capability, `SKILL_FRONTEND_DESIGN.md` §7.6 is the operating mode **from day one**, not an exception discovered late: say so explicitly, list every screen that could not be visually verified, produce a manual verification checklist for the operator, mark each such screen *"built, not visually verified"*, and **keep the phase open**.

---

## 1. Reading order (skill §2)

Read all six before the first component, in this order:

1. **`design/DESIGN.md`** — the visual and interaction blueprint. Wins on every visual conflict.
2. **This plan** — build order, data binding, testing strategy, process anti-patterns.
3. **`design/references/`** — direction, not specification (§4).
4. **`docs/PRODUCT_PRD.md`** — what the product is.
5. **`docs/TECHNICAL_SPEC.md`** — the stack. Wins on any stack matter.
6. **`SKILL_FRONTEND_DESIGN.md`** — when to deploy and what counts as done.

Then, per `README.md`'s source-of-truth hierarchy, the rest of `docs/` as needed for the screen in hand: `UX_SPEC.md` (behaviour), `DATA_MODEL.md`, `API_CONTRACTS.md`, `SECURITY_SPEC.md`, `EXTENSION_SPEC.md`, `TESTING_QA.md`, `DECISIONS.md`.

**Re-read items 1 and 2 before each wave and before each screen.** The cost is minutes; the omission costs a rewrite.

`docs/DECISIONS.md` is highest authority. Anything logged there overrides this plan and the design document.

---

## 2. The single token layer (skill §3)

### 2.1 Location — provisional, must be bound in hour one of Stage K

| Item | Value |
|---|---|
| Token layer (single source) | `apps/web/src/styles/tokens.css` — **provisional** |
| Derived/component styles | `apps/web/src/styles/` — may reference tokens, may not define raw values |
| Gallery route | `apps/web/src/app/(dev)/gallery/page.tsx` — **provisional** |

If the one-shot build established a different web-app location, the token layer moves with it. **There is exactly one token layer.** If a second one appears, the second one is deleted, not merged.

If a value this plan needs does not exist in `tokens.css`, add it to the token layer **first**, then decide whether `design/DESIGN.md` needs to record it, then use it. Never inline it "just this once".

### 2.2 The mechanical enforcement check

A token scan must exist, must run in the standard check command, and must **fail the build**.

**Exact commands.** The scan script is added at `scripts/check-design-tokens.mjs` and is wired into the root `check` script:

```jsonc
// package.json (root scripts)
{
  "check": "pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run check:tokens",
  "check:tokens": "node scripts/check-design-tokens.mjs"
}
```

What `scripts/check-design-tokens.mjs` must reject, with a non-zero exit code:

1. Any raw hex literal (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) outside `tokens.css`.
2. Any raw `rgb()` / `rgba()` / `hsl()` colour literal outside `tokens.css`.
3. Any `px` value matching a spacing, radius, type-size, line-height, letter-spacing, duration, or easing token's scale, outside `tokens.css`.
4. Any `ms` / `s` duration literal outside the motion helper module and `tokens.css`.
5. Any direct import of the animation or haptics library from a component file (§5).
6. Any font-family literal outside the token layer.

The scan must also **exclude** its own source file and the gallery route's documentation blocks, and that exclusion list must be printed on every run so it is never a silent blind spot (skill §7.5).

### 2.3 Prove the check before trusting it

**A scan that has never failed is not known to work.**

Before the check is allowed to report "clean" for the first time, plant a violation and confirm it is reported:

1. Add a deliberate out-of-token hex (e.g. `#7d5fff`) to a throwaway component.
2. Run `pnpm run check:tokens`. It must exit non-zero and name the file and the offending value.
3. Remove the planted violation.
4. Run it again. It must exit zero.

Both outcomes are recorded in the phase record. Only after step 4 may the scan's zero result be believed. If the check cannot be made to fail on a planted violation, it is broken and must be fixed before any screen is built.

### 2.4 Component contract

No screen before its components. No component before its tokens. Every component ships with:

- explicit prop types;
- an accessibility label for every icon-only control;
- empty, loading, and error behaviour;
- a reduced-motion path;
- a test.

Extending an existing component with an optional prop whose default preserves current rendering is preferred over adding a new component. Every genuinely new component is justified in the phase record.

---

## 3. Component-first waves

Waves are ordered. **Each wave is verified before the next begins.** Every wave's verification happens in the gallery route, at all four breakpoints, plus the narrow-width stress section.

### Wave 0 — Foundation

Tokens (`tokens.css`), font loading, reset, base element styles, colour-scheme, spacing/type/motion token groups.

**Gate:**
- `pnpm run check:tokens` exists, is wired into `pnpm run check`, and **has been proven to fail on a planted violation** (§2.3).
- Every colour, type step, spacing value, radius, duration, and easing in `design/DESIGN.md` §2–§6 exists as a token.
- All three families load, each weight explicitly, verified **by rendered pixels** — not by a resolved `font-family` string. A family name covering several weights with no matching loaded face silently falls the whole type system back to a system serif and no test fails.
- The dark surface extends to the viewport edge with no light gap at any breakpoint.
- Measured contrast for every new pairing in `design/DESIGN.md` §2.4 and §2.6 meets §4.4 of this plan.

### Wave 1 — Signature devices and framing

`Stack`, `Inline`, `Section`, `Panel`, `ChamferPanel`, `Rule`, `GridField`, `Eyebrow`, `SectionNumber`, `SignalLine`, `Reticle`, `CoordinatePair`, `PageShell`.

**Gate:**
- Gallery renders every variant of every component above, at 375 / 768 / 1280 / 1440.
- `SignalLine` reveals once and is then still. It does not loop, and it does not animate on any inner panel.
- Chamfered panels: at most three per screen in the built screens; chamfer size comes from a token.
- No shadow-based elevation anywhere outside the overlay tier.
- Reduced motion forced on: `SignalLine` renders final-state with no sweep.

### Wave 2 — Actions and form controls

`Button`, `IconButton`, `LinkButton`, `SegmentedControl`, `Field`, `TextInput`, `NumericInput`, `Textarea`, `Select`, `LeverageStepper`, `ExpiryControl`, `Checkbox`, `Toggle`, `ValidationMessage`.

**Gate:**
- Every interactive element meets the documented minimum target **measured, not by eye**.
- Press state verified by **computed style after the press**, for every variant and size.
- Visible focus ring on every focusable element, checked in both normal and forced-colors rendering.
- Every icon-only control has an accessible name.
- Validation messages are text + `aria-live`; no validation is signalled by border colour alone.
- Live validation for price ordering, supported market, leverage bounds, expiry validity, and TP/SL direction consistency is exercised in the gallery with deliberately invalid values.

### Wave 3 — Data display

`StatBlock`, `StatRow`, `DataTable`, `DataCell`, `PriceCell`, `PnlCell`, `StatusChip`, `Tag`, `Timestamp`, `Address`, `DirectionBadge`.

**Gate:**
- **Realistic magnitudes.** Fixtures use realistic values from PASS's own domain. The reference's short sample numbers are not representative and hide layout defects real values expose.
- Tabular figures align; a value changing from `1,000.00` to `999.99` does not reflow its neighbours.
- Every lifecycle state in `design/DESIGN.md` §11.7 renders as a chip with **text**, and none uses a filled accent background.
- PnL cells carry a sign glyph; colour is present but never load-bearing.
- Prices are never re-rounded client-side; decimals follow the market convention supplied by the API.
- Long addresses truncate as `0x1234…cdef` and expose the full value to assistive technology.

### Wave 4 — Identity, reputation, and state blocks

`Avatar`, `HandleBlock`, `ReputationBlock`, `PerformanceBlock`, `ConnectionChip`, `LoadingBlock`, `EmptyBlock`, `ErrorBlock`, `UnavailableBlock`, `StaleBlock`, `PermissionBlock`, `RejectedBlock`.

**Gate:**
- Every provider-dependent component renders **all** of empty, loading, error, and success. Skipping any one to hit a milestone is a process anti-pattern (§7).
- `LoadingBlock` is a static sunken surface with an accent hairline. No shimmer loop.
- `ReputationBlock` and `PerformanceBlock` are visually distinct, with a rule between them, and cannot be composed into one card without a design change.
- No synthetic trust label exists anywhere in the gallery.
- **Narrow-width stress pass on the gallery** covering long values, wrapping rows, long labels, and extreme numbers. Run this **before** any extension or deployed pass.

### Wave 5 — Overlays and chrome

`Dialog`, `BottomSheet`, `Popover`, `Tooltip`, `Toast`, `TopBar`, `Sidebar`, `BottomNav`.

**Gate:**
- Focus is trapped in overlays and restored on close; `Escape` closes; background is inert.
- Overlays use the overlay tier only; `--shadow-overlay` appears nowhere else in the codebase (the token scan enforces this).
- `Sidebar` and `BottomNav` **export their own dimensions as tokens**, so the space reserved for them and the space they occupy cannot drift apart.
- Bottom nav reserves `env(safe-area-inset-bottom)` plus its own height, and the content padding that clears it is **measured**.
- The gallery route is gated out of production, and the gating is **verified both anonymously and signed in** — not assumed.

### Wave 6 — Extension surfaces

`ExtensionCard`, `ExtensionBadge`, `ExtensionPopup`.

**Gate:**
- Manifest V3, permissions as narrow as possible, no remote executable code, no private keys in content-script state.
- The card survives X SPA navigation without duplicating itself and without leaking observers.
- `View Pass` deep-links from X to a real, deployed Pass page that renders.
- The popup is 320px wide and carries exactly one accent-filled action.
- No price, PnL, chart, or execution control appears on any extension surface.

### Wave 7 — Screens

Built in the order of `design/DESIGN.md` §10:

1. Shell + Landing (§10.1)
2. Discover (§10.2)
3. **Pass detail (§10.3)** — the core conversion surface; build with the most scrutiny
4. Trader profile (§10.4)
5. Create Pass (§10.5)
6. Take flow, all four steps (§10.6)
7. Stale Pass interstitial (§10.7)
8. My Passes (§10.8)
9. Executions (§10.9)
10. Profile and connections (§10.10)
11. Onboarding and connect (§10.11)
12. Error and not-found (§10.12)
13. Social preview / Open Graph (§10.14)

Each screen obeys the per-screen delivery contract in §4. Screens are **not** batched — one screen is finished, verified, deployed, and re-verified before the next begins.

---

## 4. Per-screen delivery contract

A screen is not done because it compiles, because tests pass, or because a snapshot matches. **If any line below is unsatisfied, the screen is not done.** A line that cannot be satisfied with available tooling is recorded as a gap with a manual checklist, never quietly dropped.

### 4.1 Binding

- [ ] Real bindings from the real pipeline. Mock data is permitted only in test fixtures and a clearly labelled demo path — **never in a production code path**.
- [ ] **Read the caller, not the prop list.** A control that is present, styled, sized, labelled, and inert is the single most under-inspected defect shape. Any optional prop introduced must be traced to a caller, or removed.
- [ ] Before reusing a shared mutation or setter, **read what it actually writes**. If the operation needs a subset of its effects, write a narrow operation that writes exactly that subset, and test that the other effects do not occur. Naming is not a contract; the body is.

### 4.2 States

- [ ] Renders with real data from the real pipeline.
- [ ] Empty state.
- [ ] Loading state.
- [ ] Error state, with retry.
- [ ] Success state.
- [ ] Stale data indication.
- [ ] Permission / auth required, with the specific reason.
- [ ] Execution rejected, with the provider's reason.

### 4.3 Measurement — measure, do not eyeball

- [ ] Every interactive element meets the minimum target size, **measured**.
- [ ] Every icon-only control has an accessibility label.
- [ ] No element escapes the viewport horizontally, **measured**, at every breakpoint.
- [ ] No text is clipped, ellipsized, or broken mid-word, **measured**.
- [ ] Every new colour pairing's contrast is **computed programmatically**, not judged.
- [ ] Colour is never the sole carrier of meaning.
- [ ] **Any field that must be visible within a given viewport is asserted by measured position, never by snapshot.** Walk that field's position at the top, middle, and end of the data set — its position relative to siblings varies with the data. On the Pass page and the Take flow this means: asset + direction, status, entry/TP/SL, and the primary CTA must be within the first viewport at 375×812.
- [ ] The reserved clearance between bottom navigation and the end of content is measured.
- [ ] Every data visualization exposes its values as text to a screen reader.
- [ ] Any region excluded from a measurement — because it is intentionally wider — has the exclusion **and its reason recorded** in the phase record. A silent exclusion is indistinguishable from a hidden defect.

### 4.4 Contrast minimums

| Content | Minimum |
|---|---|
| Body text and data | 4.5:1 |
| Large text (≥24px, or ≥19px bold) | 3:1 |
| UI component boundaries, focus indicators, meaningful non-text graphics | 3:1 |

If the design itself mandates a value that fails one of these, **measure it, report the ratio, name the clause in `design/DESIGN.md` that mandates it, and stop.** Correcting it is a design decision, not a code patch. Keep it visible in the phase record as a known residual with everything else about the element fixed.

### 4.5 Motion

- [ ] Every animation is invoked through a motion helper (§5).
- [ ] Every animation states its purpose: orient, confirm, or explain.
- [ ] Nothing exceeds `--duration-deliberate` (420ms). Nothing loops.
- [ ] Reduced-motion rendering is verified with the setting **forced on**.

### 4.6 Evidence

- [ ] A screenshot of each state at each viewport, captured from the **deployed** URL, attached to the phase record.
- [ ] The screen has been opened in a browser and **used as a user** (§6).
- [ ] The screen has been opened in a real Chrome profile with the extension loaded, for extension surfaces.
- [ ] **The second pass after fixes is clean.**

### 4.7 Derived-figure discipline

- [ ] Every derived figure states its eligibility rule at the point it is introduced: which rows, which window, which filters.
- [ ] A derived total never inherits a filter intended for a different total.
- [ ] Any figure shown on more than one surface is defined **once**; both surfaces read the same field, filters, and window. If two definitions disagree semantically, decide which is correct, record the decision, and change the other — do not average them and do not leave both.
- [ ] All date windows use the one project convention, half-open `[start, end)`, with an explicit timezone basis, and clamp when stepping across periods.

---

## 5. Motion helper boundaries (skill §5)

Motion is a system, not a per-component decision.

- **Durations and easings live in the token layer** (`design/DESIGN.md` §6.2, §6.3). No component writes a duration or a cubic-bezier.
- **Animation behaviour lives in shared helpers**, one module: `apps/web/src/motion/` — **provisional**.
- **Components call helpers.** A component that imports the animation library directly is a defect **even if it looks right**. The token scan (§2.2, check 5) rejects it mechanically.
- **Every helper collapses to instant or fade-only** when the OS reduced-motion setting is on. The switch is read in one place and helpers honour it; no component re-implements the check.
- **Press feedback is part of the component contract**, defined once and inherited, not re-authored per screen.
- **Haptics: none.** PASS has no haptics surface (§6.7 of the design document). No haptic vocabulary is introduced. If a future surface needs one, it is a design amendment, not a per-component decision.
- **No animation runs on a UI thread or worklet callback unless the callback and every function reachable from it are themselves marked as such.** A callback calling ordinary application code works in a browser and is fatal on device; it is invisible to the entire web target and to every test in the suite. If the animation toolchain uses a compiler plugin, its presence is gated by a static test **proven to fail when the plugin is removed**.
- Diagnose animation failures with a development client and its error overlay. Use a release build for verification, never for diagnosis.

---

## 6. Agent-as-user verification protocol (skill §7)

### 6.1 Principle

The agent must **look at** the rendered screen and interact with it. Reading source code is not visual inspection. A passing test is not a passing screen. A matching snapshot is a passing atom, not a passing screen.

**Never write "verified" next to a behaviour the agent did not observe.**

### 6.2 The pass

Run for every screen, and again after every fix that changes a visual or layout outcome.

1. Open the **deployed** URL in a **fresh session** — no cached auth, no stored state.
2. Use a **real account created through the product's own connect/signup path**, not a hand-inserted database row the product could never produce.
3. Walk the primary journey **through the UI only**. Do not call the API directly for this pass; that hides exactly the class of defect the pass exists to catch.
4. Capture screenshots of every meaningful state transition at **mobile 375×812** and **desktop 1280×800**. Also spot-check 768 and 1440 for layout, per §4.3.
5. Interact with **every** interactive element: click, tap, type, submit, dismiss, toggle, scroll — and **submit deliberately invalid input** to see the error path.
6. Trigger empty, loading, error, and success states. Throttle for loading; cut the network for error.
7. **Read the console and the network log.** Record every console error and warning, every non-2xx response, every failed asset, every unexpected redirect, every action slower than two seconds.
8. **Measure and record** the numbers listed in §4.3.
9. **Walk the product as a person would**, not screen by screen. Ask the questions a person would ask — *why do these two numbers differ?* — and follow the answer to the field, window, or default that caused it.
10. **Read any two screens that show the same quantity for the same period side by side**, with the same data, and compare the rendered numbers. Definition mismatches are invisible when each screen is inspected alone and jump out here. Specifically: Pass performance vs Trader performance; a Pass's PnL vs the corresponding Executions row; counts on Discover vs counts on My Passes.
11. Compare against the screen's section in `design/DESIGN.md` **and both anti-pattern lists** (§7).
12. Categorize every finding using **these six and no others**:
    `blocks-loop` · `visual-defect` · `accessibility` · `design-violation` · `anti-pattern` · `nice-to-fix-later`
13. Fix everything in the first five **inside the current phase**. Log the sixth for later by name rather than expanding scope.
14. **Re-deploy and repeat the whole pass on the fixed version.** A screen is complete only when the second pass is clean.

### 6.3 Measure the suspicion

When a defect is suspected, **measure it before theorising**. A field believed to be failing to save may be saving correctly and sitting below the fold; a value believed to be a rendering fault may be a timezone boundary. Both are settled in minutes by measuring the rendered box or the rendered number, and both would have been "fixed" wrongly by reading the code and guessing.

### 6.4 Record the acquittals

Record what was **investigated and cleared**, separately from what was found. A pass that lists only its findings implies the rest was never checked, and it loses the distinction between *"verified correct"* and *"not looked at"*. The acquittal list is part of a complete pass.

### 6.5 Fix-pass discipline

- One verified defect at a time, or one coherent group. A bundle of unproven changes in a single release build means that when the surface still misbehaves, nothing is attributable.
- Correct the cause, not the symptom. Never correct `design/DESIGN.md` to match a buggy implementation.
- Re-verify after fixing. A fix that is not re-verified is a hypothesis.
- If a fix needs a design decision that does not exist, **stop and record the gap**.

### 6.6 Never do

- Claim a screen "matches the design" without having opened it.
- Approve a screen from tests, snapshots, or source reading alone.
- Hide a defect behind a branch that only affects your own viewport, user agent, or session.
- Declare "visually verified" while the tooling reported render errors.
- Reuse a helper without reading what it does.

### 6.7 If there is no browser capability

Per §0.1 and skill §7.6: say so explicitly; list every screen not visually verified; produce a manual checklist with a copy-paste result template; mark screens *"built, not visually verified"*; and **keep the phase open**.

---

## 7. Process anti-patterns (skill §11)

Checked on every screen alongside the design document's §12 list.

- Installing a UI framework to save time. Every shipped screen is a composition of this project's own components. No framework is installed without an explicit amendment to `design/DESIGN.md`.
- Hard-coding a value outside the token layer "because it is one occurrence".
- Calling the animation library directly from a component for one effect that "obviously" did not need a helper.
- Building a screen before its components existed, then discovering mid-screen that a needed primitive had no reduced-motion or empty-state behaviour.
- Writing screen code against mock data and calling it "wired".
- Skipping empty, loading, or error states to hit a milestone.
- Declaring a screen done without opening it.
- Editing the design document to match what was built. If the design is genuinely silent, amending it is a logged, separate act.
- Claiming a screen "matches the design" without having looked at it.
- Bundling multiple unproven fixes into one release build.
- Asserting a fix was verified when only the first of two passes ran.
- **Trusting a scan that has never failed** (§2.3).
- Silently excluding a region from a measurement.
- Calling the same calculation from two surfaces and believing that makes the definitions shared.
- Anchoring an overlay to a proportional fill with a pixel assumption.
- Routing a narrow write through a broad helper.
- Reaching into a caller to discover why a control is inert, rather than reading the caller and passing the prop.
- Letting an animation callback call ordinary application code.

---

## 8. Deployment gate (skill §8)

### 8.1 Target

| Surface | Target |
|---|---|
| Web frontend | **Vercel production**, the deployment created in Stage J |
| Backend / API / worker | Stage J production deployment, unchanged by Stage K |
| Extension | Build artifact (`dist/`), loaded unpacked in a real Chrome profile |

Every frontend phase ends with a **deployed, reachable build**. The deployed URL is the only artifact that counts; a local build, a passing export, or a green test suite is not a deliverable.

### 8.2 Secret-scan step — required before every push

Run, in this order, and do not push if any step fails:

```bash
pnpm run check            # lint + typecheck + test + check:tokens  (§2.2)
pnpm run scan:secrets     # grep the built output for server secrets
pnpm run build            # the build whose output was just scanned
pnpm run scan:secrets     # scan the real build output, not a previous one
```

`scan:secrets` must fail the run when the built output contains any of:

- a private key or seed-phrase marker;
- an OAuth client secret;
- a database URL with credentials;
- any value matching the project's server-secret naming convention;
- more public configuration values than the phase expects.

The scan must also **report what it expected to find and did not**, so a silently-empty grep cannot pass as clean.

Per `AGENTS.md`, never store wallet secrets in `localStorage`, never log private keys, seed phrases, OAuth client secrets, or plaintext refresh tokens. If any of these appear in the build output, that is a P0 and the deploy is blocked.

### 8.3 Verify the deployed artifact

- Confirm the bundle contains what the phase added.
- Confirm it contains **exactly** the expected public configuration values.
- Confirm it contains **no server secret**.
- Watch for the host's default protections: a first deployment behind an authentication wall is **not deployed**, no matter what the dashboard says.
- Screenshots of the **deployed** result go into the phase record.

### 8.4 When the build service does not stamp its source revision

Verify **tree equality** against the intended commit instead, and record that the artifact is trusted by content rather than by stamp.

### 8.5 Dual-surface reality

Web is the fast loop; the **real Chrome profile with the extension loaded** is the reality check. Iterate on web because it is seconds, then verify in the real profile because that is where layout-engine defaults, extension CSP, injection timing, X SPA navigation, and permission behaviour actually fail.

Where the agent cannot drive a real Chrome profile, the operator becomes the verification instrument: give them a specific checklist and a hard-to-misreport result template, and **keep the phase open** until it comes back.

---

## 9. Phase records

### 9.1 Where they live

```text
design/phase-records/
├── README.md                  # index: one row per phase, with commit + deploy URL
├── PHASE_00_tokens.md
├── PHASE_01_signature_devices.md
├── ...
└── findings/
    └── deferred.md            # the named `nice-to-fix-later` backlog
```

One file per wave in §3. Named for the wave, zero-padded, never overwritten — history is preserved and superseded entries are marked, never deleted.

### 9.2 What each record contains

1. **Header** — phase name, date, stage (`K`), author.
2. **Scope** — what this phase was supposed to deliver, and what it deliberately did not.
3. **Design document read** — confirmation that `design/DESIGN.md` and this plan were re-read before the phase started.
4. **Commit hash** — the per-phase commit SHA. Deployed artifact's own hash if it differs.
5. **Deploy URL** — the Vercel production URL verified in this phase, and the timestamp it was verified.
6. **Token-check proof** — for Wave 0, the planted-violation evidence (§2.3): what was planted, the failing output, and the clean re-run. For later phases, the check's exit status.
7. **Screenshots** — every state, every viewport, from the deployed URL. Attached or linked, not described.
8. **Measurements** — the §4.3 numbers as measured values, not as pass/fail. Including every intentional measurement exclusion and its reason.
9. **Findings** — each with: what was observed, how it was reproduced, the category from the six, and the disposition (fixed this phase / deferred by name / escalated as a design gap).
10. **Acquittals** — what was investigated and cleared, with the evidence that cleared it.
11. **Design-gap log** — every hit against §13 of `design/DESIGN.md`, or a new gap this phase discovered. For each: the screen, what was needed, what was missing, and what was deliberately **not** done.
12. **Design amendments** — any change to `design/DESIGN.md` made in this phase, with a stated reason, as a separately recorded deliverable. Never a side effect of coding.
13. **Rejected alternatives** — for each significant choice, what was rejected and why.
14. **Consistency readings** — the §6.2 step 10 side-by-side comparisons performed, with the numbers compared.
15. **Open items** — what remains open, and whether the phase is closed or gated.

### 9.3 Closing a phase

A phase closes only when:

- every screen in it has cleared its delivery contract, including a clean **second** pass;
- every finding in the first five categories is fixed;
- every deferred item is named in `findings/deferred.md`;
- every open design gap is recorded;
- the deployed artifact was verified per §8.3;
- the record is committed with its commit hash.

**A phase is not closed on the strength of tests.** If verification depends on a human instrument, the phase stays open until it comes back.

---

## 10. Explicit sequencing statement

> Stage K — the frontend design track defined by `SKILL_FRONTEND_DESIGN.md`, executed by this plan against `design/DESIGN.md` — begins **only after** Stage J verification is signed off, per `docs/DECISIONS.md` D-017.

- Stage J's stop/verify gate is **not** weakened, reopened, or re-scoped.
- The one-shot build's completion criteria in `docs/IMPLEMENTATION_PLAN.md` §6 and `docs/AI_HANDOFF.md` remain in force, but **"visually complete" is removed from the one-shot gate** and moved here.
- Stage K's outputs — the screens, the components, and the design system tokens — are the deliverable of **Stage K**, not of Stage J.
- Nothing in this plan authorises beginning the one-shot build, and nothing in Stage K weakens a Stage A–J gate.