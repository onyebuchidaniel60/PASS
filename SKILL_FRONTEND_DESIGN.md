# SKILL — Frontend Design and Build

**Type:** Craft skill (overlay).
**Version:** 1 — earned. Written only after at least one screen completed the
full cycle (build → test → deploy → agent-as-user pass → fix → re-deploy →
clean second pass) on **both** a web and a real-device surface.
**Applies to:** Frontend implementation in any project that has a design
document, a visual reference, and a frontend implementation plan.
**Does NOT replace:** the project's design document, frontend implementation
plan, product spec, architecture document, or agent rules.
**Complements:** a delivery-sequencing skill (sequencing and deployment
gating) and a workflow-discipline skill (how each slice is executed).

Every rule below is either **earned** — observed failing or succeeding during a
real build cycle — or explicitly marked **inherited — pending validation**.
Anything unearned and unmarked is a defect in this file.

---

## 1. Core principle

The frontend is not a coat of paint on the backend. It is a product surface,
and it gets the same rigor as the data model.

Design decisions are made before code, in the design document. Build decisions
are made before code, in the frontend implementation plan. The agent executes
both faithfully rather than reinterpreting them.

A screen is not "done" because it compiles, because tests pass, or because a
snapshot matches. It is done when it has been **rendered, opened, used as a
user, measured, and compared against the design document** — on every surface
the product ships to.

The corollary, learned the hard way: a single-surface pass is not a pass. The
web target and the device target fail differently, and each failure class is
invisible to the other.

---

## 2. Reading order before writing any frontend code

1. **The design document** — the visual and interaction blueprint. It wins on
   every visual conflict.
2. **The frontend implementation plan** — build order, data binding, testing
   strategy, anti-patterns.
3. **The visual reference images** — direction, not specification (see §4).
4. **The product spec** — what the product is.
5. **The architecture document** — the stack. It wins on any stack matter.
6. **The delivery-sequencing skill** — when to deploy and what counts as done.

Read all six before the first component. Read 1 and 2 again before each wave and
each screen; the cost is minutes, the omission costs a rewrite.

**Inherited — pending validation:** "read all six before the first component"
was followed on this project and no violation of it was ever observed, but it
was never tested adversarially.

---

## 3. Component-first workflow

- No screen before its components.
- No component before its tokens.
- No token is invented. Every color, type step, spacing value, radius, duration,
  and easing comes from the design document and lives in the project's single
  token layer.
- No such value appears anywhere else in the codebase — not in a screen, not in
  a component, not in a test fixture's style block.
- **Enforcement is mechanical, not aspirational.** A check that greps for
  out-of-token values must exist, must run in the standard check command, and
  must fail the build. Before trusting its zero result, prove the check works by
  planting a violation and confirming it is reported. A scan that has never
  failed is not known to work.
- If a value is genuinely missing, add it to the token layer **first**, then
  decide whether the design document needs to record it (see §4), then use it.
  Never inline it "just this once."
- Each component ships with: prop types, accessibility labels for every
  icon-only control, empty/loading/error behaviour, a reduced-motion path, and
  a test.
- Extending an existing component is preferred to adding a new one. An additive,
  optional prop with a default that preserves current rendering is the cheapest,
  safest form of extension. Justify every genuinely new component in the phase
  record.

**Earned:** the token check caught nothing on its first run, which is exactly
when it is least trustworthy. It was proved with a planted violation before it
was ever allowed to report "clean."

---

## 4. Reference-driven decisions

The workflow for any screen:

1. Read that screen's section in the design document.
2. Look at the reference image for **feel and direction** — proportion,
   hierarchy, density, tone. Never for layout.
3. Compose from existing components. Do not create a component unless the
   design document or the plan calls for one.
4. Check the screen against the design document's anti-pattern list and the
   plan's process anti-pattern list.
5. If the screen needs a visual decision the design document does not cover:
   **stop and record the gap.** Either the gap is a real hole in the design
   document, in which case amending the design document is a legitimate,
   separately recorded deliverable of the phase; or the design document does
   cover it and the implementation is wrong. Never invent visual language to
   fill the hole. Never quietly adjust a specified value.

The same rule applies in reverse: if the implementation is wrong, the design
document does **not** get edited to match the implementation. A design
amendment is a deliberate, logged act with a stated reason — not a side effect
of coding.

**Earned:** two design-document amendments were made during the audited build
(the only ones in the whole frontend layer), each because the design was
genuinely silent on a behaviour that shipped. Both were logged as design gaps,
not as fixes.

**Anti-reference discipline.** Do not copy layouts literally, do not reproduce
branding, do not lift a competing type family, and do not reproduce the
reference's dummy data or placeholder values. Build fixtures must use realistic
magnitudes from the product's own domain — the reference's short sample numbers
are not representative and they hide layout defects that real values expose.

---

## 5. Motion is first-class

- Motion is a system, not a per-component decision. Durations and easings live
  in the token layer; animation behaviour lives in shared helpers.
- Components call helpers. A component that reaches for the animation library
  or the haptics library directly is a defect even if it looks right.
- Every animation states its purpose: **orient**, **confirm**, or **explain**.
  Motion that only decorates is removed, not kept because it looked nice.
- Reduced motion is not optional. Every helper collapses to instant or fade-only
  when the OS reduced-motion setting is on, and a screen must be verified with
  it forced on.
- Haptics are wrapped in helpers with a small fixed vocabulary (confirm,
  select, destructive). No haptic on scroll, hover, or passive state.
- No animation exceeds the documented cap, and nothing loops.
- Press feedback is part of the component contract, not a per-screen flourish.

**Inherited — pending validation:** the "one animation library" and
"no motion without a stated purpose" rules were followed throughout and never
caused a defect, but no case arose where they had to be enforced against a
proposal to add decoration.

---

## 6. Visual validation gate

A screen is not complete until every one of these is true:

- It renders with **real data from the real pipeline**, not a fixture.
- It renders in empty, loading, error, and success states.
- Every interactive element meets the documented minimum target size, verified
  by measurement rather than by eye.
- Every icon-only control has an accessibility label.
- Every color pairing passes the documented contrast minimum — measured
  programmatically, not judged by eye.
- Color is never the sole carrier of meaning.
- Reduced-motion rendering is verified.
- Every data visualization exposes its values as text to a screen reader.
- **Fields that must be visible within a given viewport are asserted by
  measured position, not by snapshot** (see §9, rule 4).
- A screenshot of each state at each viewport is captured and attached to the
  phase record.
- It has been **opened in a browser and used as a user** (§7).
- It has been **opened on a real device** and used as a user, once the product
  ships to a device.
- The second pass after fixes is clean.

If any line is unsatisfied, the screen is not done. An unsatisfied line that
cannot be satisfied with the tools available is **recorded as a gap with a
manual checklist**, never quietly dropped.

---

## 7. Agent-as-user verification protocol

Applies whenever the agent has browser automation or equivalent. If it does
not, §7.6 applies.

### 7.1 Principle

The agent must look at the rendered screen and interact with it. Reading source
code is not visual inspection. A passing test is not a passing screen. A
matching snapshot is a passing atom, not a passing screen.

Never write "verified" next to a behaviour the agent did not observe.

### 7.2 The pass

For every screen, and after every fix that changes a visual or layout outcome:

1. Open the **deployed** URL in a fresh session — no cached auth, no stored
   state.
2. Use a **real account created through the product's own admin or signup
   path**, not a hand-inserted database row the product could never produce.
3. Walk the primary journey **through the UI only**. Do not call the API
   directly for this pass; doing so hides exactly the class of defect this pass
   exists to catch.
4. Screenshot every meaningful state transition at a mobile viewport
   (375×812) and a desktop viewport (1280×800).
5. Interact with every interactive element: click, tap, type, submit, dismiss,
   toggle, scroll, and submit deliberately invalid input to see the error path.
6. Trigger empty, loading, error, and success states. For loading, throttle if
   possible; for error, cut the network.
7. **Read the console and the network log.** Record every console error and
   warning, every non-2xx response, every failed asset, every unexpected
   redirect, every action slower than two seconds.
8. Measure, do not eyeball, and record the numbers:
   - any element whose box escapes the viewport horizontally,
   - any pressable smaller than the minimum target,
   - any icon-only control with no accessible label,
   - any text that is clipped, ellipsized, or broken mid-word,
   - the computed contrast of each new color pairing,
   - the position of any field that must be above the fold,
   - the reserved clearance between floating navigation and the end of content.
9. Compare against the screen's section in the design document and against both
   anti-pattern lists.
10. Categorize every finding, using these six and no others:
    `blocks-loop`, `visual-defect`, `accessibility`, `design-violation`,
    `anti-pattern`, `nice-to-fix-later`.
11. Fix everything in the first five categories inside the current phase. Log
    the sixth for later rather than expanding scope.
12. Re-deploy and **repeat the whole pass on the fixed version.** A screen is
    complete only when the second pass is clean.

### 7.3 Measure the suspicion

When a defect is suspected, measure it before theorizing about it. On this
project, a field believed to be failing to save turned out to save correctly and
to sit below the fold; a value believed to be a rendering fault turned out to
be a timezone boundary. Both were settled in minutes by measuring the rendered
box or the rendered number, and both would have been "fixed" wrongly by reading
the code and guessing.

The same discipline has a second half: **record what was investigated and
cleared.** A pass that lists only its findings implies the rest was never
checked, and it loses the distinction between "verified correct" and "not
looked at".

### 7.4 Fix pass discipline

- One verified defect at a time, or one coherent group. A bundle of unproven
  changes inside a single release build means that when the device still
  misbehaves, nothing is attributable.
- Correct the cause, not the symptom, and never the design document.
- Re-verify after fixing. A fix that is not re-verified is a hypothesis.
- If a fix requires a design decision that does not exist, stop and record it.

### 7.5 What the agent must never do

- Claim a screen "matches the design" without having opened it.
- Approve a screen from tests, snapshots, or source reading alone.
- Modify the design document to match a buggy implementation.
- Hide a defect behind a branch that only affects the agent's own viewport, user
  agent, or session.
- Declare "visually verified" while the tooling reported render errors.
- Exclude a region from a measurement because it is *intentionally* wider —
  without recording the exclusion and its reason in the pass report. A silent
  exclusion is indistinguishable from a hidden defect.
- Reuse a helper without reading what it does. Shared code carries side effects
  (§9, rule 6).

### 7.6 When the agent has no browser or device capability

- Say so explicitly in the phase report.
- List every screen that could not be visually verified.
- Produce a manual verification checklist for the operator: every screen in
  walk order, the specific checks only a device can settle, and a
  copy-paste result template.
- Mark the screen "built, not visually verified." It cannot be called done until
  a human or a browser-capable agent completes the pass.
- Keep the phase **open** — gated on that verification — rather than closing it
  on the strength of tests.

---

## 8. Deployment gate

- Every frontend phase ends with a deployed, reachable build.
- **The deployed URL is the only artifact that counts.** A local build, a
  passing export, or a green test suite is not a deliverable.
- Verify the deployed artifact, not the local one: the bundle must contain what
  the phase added, must contain exactly the expected public configuration values,
  and must contain **no server secret**. Grep the built output before every push.
- Watch for the host's default protections. A first deployment behind an
  authentication wall is "not deployed" no matter what the dashboard says.
- Screenshots of the **deployed** result go into the phase record.
- **Web is the fast loop; the device is the reality check.** Iterate on web
  because it is seconds, then verify on a real device because that is where the
  remaining defect classes live: layout engine defaults, soft keyboards, safe
  areas, font rendering, shadows, touch ergonomics, and any code that executes
  on a separate UI thread.
- Both are required from the point a device target exists. Neither substitutes
  for the other.
- Where the agent cannot install a device build, the operator becomes the
  verification instrument. Give them a specific checklist and a
  hard-to-misreport result template, and keep the phase open until it comes
  back.
- When a build service does not stamp the source revision it built from, verify
  tree equality against the intended commit instead, and record that the
  artifact is trusted by content rather than by stamp.

---

## 9. Ten earned rules

Each rule below became a rule because it was violated or nearly violated on a
real build. They are stated platform-neutrally so they transfer.

### Rule 1 — Unify the definition, not the call site

Two surfaces can call the same calculation helper and still disagree, because
they read different fields of its result — one reads a gross figure, the other
a net one. Deduplicating the *call* is not deduplicating the *definition*.

> **Rule.** When two surfaces present the same figure, verify they read the
> same field, the same filters, and the same window. If they do not, extract
> **one definition** and have both call it. When the two definitions disagree
> semantically, decide which is correct, record the decision, and change the
> other — do not average them or leave both.
>
> **Rationale.** The shared-helper illusion is invisible in review; only
> comparing the rendered numbers across two screens reveals it.

### Rule 2 — Pin date windows to one convention, and make them half-open

A local calendar month and a UTC-midnight parse of the same date look identical
in code and denote different instants. They diverge by hours near boundaries
and silently mis-bucket rows.

> **Rule.** Every project gets exactly one date-window convention, owned by one
> helper, with an explicit timezone basis. Windows are half-open
> `[start, end)` so a boundary instant cannot land in two periods. Date math
> that steps across periods must clamp to the target period's length — naive
> constructor arithmetic rolls dates forward into the following month.
>
> **Rationale.** Silent, data-dependent, and only reproducible on the rows that
> straddle a boundary.

### Rule 3 — Platform layout defaults differ; a browser pass is not a layout proof

The mobile layout engine and the browser's CSS flexbox default flex-shrink
differently. A row that is clean in a browser at phone width overflows on the
device for exactly that reason.

> **Rule.** Assume every flex row is wrong on one platform until measured there.
> Prefer shrink-and-truncate with an explicit line limit over fixed widths; a
> fixed width is a layout bug waiting for a longer value. Verify narrow-width
> behaviour on the device or through a native-width proxy, never by inferring it
> from a web pass.
>
> **Rationale.** The web pass reported zero overflow on a screen that overflowed
> on every device.

### Rule 4 — Viewport-critical fields are asserted by measured position

"Below the fold" is a real, common, and completely invisible-to-unit-test
defect class. A screen test that renders successfully proves nothing about
whether the user can see the control the screen exists to offer.

> **Rule.** For any field that must be visible within a given viewport, assert
> its measured position in the acceptance check. Never accept a screenshot.
> Walk the field's position at the top, middle, and end of the data set —
> position relative to sibling content varies with the data.
>
> **Rationale.** The defect was found by measuring a box, not by looking at a
> test result. It was also a discoverability failure, not a functional one,
> which is why every functional test was green.

### Rule 5 — Overlay labels anchored to a proportional fill need a floored anchor zone

An overlay centred over a fill ratio of 1% cannot be rendered legibly, and any
pixel-width assumption collapses as the ratio approaches zero.

> **Rule.** Any element anchored to a proportional track needs a minimum anchor
> zone, expressed as a **ratio of the track**, not as pixels, so it survives a
> fluid layout. Layer the overlay outside the clipped track so a narrow fill
> cannot hide it, and define the below-threshold behaviour explicitly.
>
> **Rationale.** Percentage labels on a fluid progress bar are a universal
> pattern and the failure appears only at the extremes — exactly where users
> rarely look and tests almost never assert.

### Rule 6 — Read the callee before reusing the helper

A helper named for one job may also do three others. A rename routed through a
"confirm" function silently flipped record status, wiped user-authored notes,
and polluted learned data.

> **Rule.** Before reusing a shared mutation or setter, read what it actually
> writes. If the operation needs a subset of its effects, write a narrow
> operation that writes exactly that subset, and test that the other effects do
> not occur. Naming is not a contract; the body is.
>
> **Rationale.** The side effects were discovered by reading the callee, and the
> damage was in user-owned state that no assertion covered.

### Rule 7 — Verify chrome on each surface independently

A header the framework draws on web may be drawn by the operating system on
device. Turning the framework header off fixes the web surface and removes a
native affordance in the same commit.

> **Rule.** Treat every piece of platform chrome as two independent surfaces.
> Verify each one on each platform, and record what each platform provides by
> default. A fix for one platform that is not explicitly justified for the
> other is incomplete.
>
> **Rationale.** One commit fixed a web defect and created a native one; only
> the device pass surfaced the second half.

### Rule 8 — Platform-conditional behaviour is a parameter, not a guess

Keyboard avoidance, status-bar treatment, and shadow rendering all need
different values per platform, and one value is wrong on at least one of them.

> **Rule.** Where a component must behave differently per platform, select the
> value explicitly from a platform check and test that the selection is made —
> not that one hard-coded value applies everywhere. A single value is a
> hypothesis until a device confirms it.
>
> **Rationale.** The keyboard case is only judgeable with a real soft keyboard;
> no browser pass and no screenshot can settle it.

### Rule 9 — A design-mandated violation is flagged, not silently fixed

Where the specified palette itself fails an accessibility minimum, the honest
move is to report the measured failure and escalate. Quietly adjusting the value
launders an unresolved design decision into a passing check.

> **Rule.** When the specification mandates a value that fails a stated
> standard, measure it, report the ratio, name the specification clause that
> mandates it, and stop. Fixing it is a design decision, not a code patch. Keep
> it visible in the phase record as a known residual, with everything else about
> the element fixed.
>
> **Rationale.** An invented correction would have hidden a real unresolved
> question behind a green check.

### Rule 10 — Code that runs on a separate UI thread must be self-contained

Animation callbacks execute on a different runtime than ordinary application
code. Calling into a normal helper from inside one **works in a browser** and
kills the app on a device. A missing compiler plugin for that animation
library removes the entire failure mode's warning and leaves nothing but the
crash.

> **Rule.** Every function reachable from a UI-thread or worklet callback must
> itself be marked as one. Audit all such call sites, not just the one that
> crashed. Gate the compiler plugin's presence in a static test that is proven
> to fail when the plugin is removed. Diagnose with a development client and
> its error overlay; a release build cycle is minutes-to-hours slower and gives
> a worse answer.
>
> **Rationale.** The failure class is invisible to every test in the suite and
> invisible to the entire web target. The stack trace that settled it came from
> a development client in under a minute.

---

## 10. Method lessons

Three habits did more defect-detection than any automated check.

### Read two screens side by side

Open two screens that present the same underlying quantity for the same period,
with the same data, and compare the numbers as rendered. Definition mismatches
jump out of a side-by-side comparison and are invisible when each screen is
inspected in isolation — each one is internally consistent, correctly derived,
and perfectly wrong in relation to the other.

### Read screens the way a user does

Do not assert on each screen separately. Walk the product as a person would and
ask the questions a person would ask — *why do these two numbers differ?* — and
follow the answer to the field, window, or default that caused it. Assertions
per screen cannot ask that question, so they never will.

### A shared helper is not evidence of a shared definition

Read the fields a helper **returns**, not the name it is called by. Two
identical call sites reading two different fields of the same result is the
single most under-inspected defect shape this project produced, and it is
invisible at every level of testing except side-by-side comparison of the
rendered output.

---

## 11. Anti-patterns actually observed

Pruned to what occurred on this project, plus what nearly occurred. A list
nobody hits is not a useful list.

**Process**

- Installing a UI framework to save time. Every screen that ships is a
  composition of the project's own components; a framework would have replaced
  a designed system with a generic one and made the design document
  unenforceable. No framework was installed and none is now permitted without a
  design-document decision.
- Hard-coding a value outside the token layer "because it is one occurrence."
  Every mechanical enforcement of this rule must be proved with a planted
  violation first, or it silently permits the thing it claims to prevent.
- Calling the animation or haptics library directly from a component, for one
  effect that "obviously" did not need a helper.
- Building a screen before its components existed, and discovering mid-screen
  that a needed primitive had no reduced-motion or empty-state behaviour.
- Writing screen code against mock data and calling it "wired". Mock data is
  permitted in test fixtures and in a clearly labelled demo path, never in a
  production code path.
- Skipping empty, loading, or error states to hit a milestone. Every screen
  ships all three or is not done.
- Declaring a screen done without opening it.
- Editing the design document to match what was built. The reverse is always
  correct, and if the design is genuinely silent the amendment is a logged,
  separate act.
- Claiming a screen "matches the design" without having looked at it.
- Bundling multiple unproven fixes into one release build. When the device still
  misbehaves, attribution is impossible and the next cycle costs a full build
  to answer a question one change would have answered.
- Asserting a fix was verified when only the first of two passes ran.
- Trusting a scan that has never failed.
- Silently excluding a region from a measurement.

**Structural**

- Calling the same calculation from two surfaces and believing that makes the
  definitions shared (§9, rule 1).
- Anchoring an overlay to a proportional fill with a pixel assumption (§9,
  rule 5).
- Routing a narrow write through a broad helper (§9, rule 6).
- Reaching into a caller to discover why a control is inert, rather than reading
  the caller and passing the prop — an optional prop existed for a long time
  with no caller, so the control was present, correctly styled, correctly sized,
  and completely inert.
- Letting an animation callback call ordinary code (§9, rule 10).

---

## 12. Evolution log

One entry per frontend phase. The format is fixed. History is preserved:
superseded rules are marked, never deleted.

A skill is written only when the verification gate it describes has actually
been cleared at least once. This file was first drafted as a blueprint
placeholder and rewritten only after a full dual-surface cycle — build, test,
deploy, web pass, fix, re-deploy, device pass, fix, re-deploy, clean second
pass — completed and the operator confirmed the result on hardware. The
placeholder is not evidence of anything and is not retained.

### 2026-09-23 — Reconcile — Phase 3 (design tokens)

Worked:
- Tokens built before any component; every value traceable to the design doc.
- Font weights loaded before first render, resolved per weight rather than by a
  single family name.
- Derived tokens (overlay tints, the two-part heading weight pair) added to the
  token layer rather than inlined at their use sites.

Didn't work:
- A single family name to cover several weights: it matched no loaded face and
  the whole type system fell back to a serif. No test failed.
- Trusting a token scan's clean report on its first run. Nothing had ever made
  it fail, so it had never been shown to work.

Agent-as-user pass caught (that tests did not):
- The serif fallback, only visible in screenshots.
- Three non-visual defects the pass surfaced while walking the loop: deep links
  404ing on the static host, to-one relations arriving as single objects where
  the code assumed arrays (zeroing several derived figures), and a prefix string
  duplicated across two layers.

design.md gaps discovered:
- The type scale named the weight pair but not how a component selects a family
  per weight. Resolved in the token layer, which was the right owner.
- Several tinted surfaces the design required had no token. The derivation was
  mechanical, so tokens were added and the design doc was left alone.

Rule changes proposed:
- Prove a static check with a planted violation before trusting its result.
- Verify font loading by rendered pixels, not by a resolved family string.

Rules validated:
- Tokens first, components second.
- No value outside the token layer.

Rules superseded:
- None.

### 2026-09-23 — Reconcile — Phase 4 (primitives)

Worked:
- Building in waves, with each wave verified before the next started.
- A dedicated gallery route rendering every primitive and variant, gated out of
  production and verified as gated both anonymously and signed in.
- Verifying interactions by computed style after pressing, not by assumption.

Didn't work:
- The first pass. It found defects, which is what made it worth running.

Agent-as-user pass caught (that tests did not):
- Deep-link routing failures on the static host, invisible to every in-process
  test.
- The serif fallback, re-confirmed as the first item to check.
- Press, selection, and focus states confirmed by computed style rather than by
  eyeballing a screenshot.

design.md gaps discovered:
- Pressable background tints and minimum-size derivations were required by the
  components but unnamed in the design doc. Added as tokens.

Rule changes proposed:
- A gallery is a real verification surface; render every variant and every
  viewport, and treat a defect found there as cheaper than a device cycle.

Rules validated:
- Wave ordering.
- Production gating of development-only routes, verified rather than assumed.

Rules superseded:
- None.

### 2026-09-24 — Reconcile — Phase 5 (charts and motion)

Worked:
- Charts as primitives with no text rendered inside the graphics layer, and
  every chart exposing its values as text for assistive technology.
- Unique, sanitized identifiers for reusable pattern fills, so two charts on one
  screen cannot collide.
- Refactoring an existing component so it had **zero** animation or haptics
  imports — the clearest possible proof that motion is a system.
- Building fixtures with realistic magnitudes from the start.

Didn't work:
- Rendering a pattern fill on an arc geometry that resized after mount: the
  hatch was invisible.
- Placing a tick label in the same gutter as the bars it labelled; they collided.

Agent-as-user pass caught (that tests did not):
- Both of the above, plus a re-proof that the type system was no longer falling
  back to a serif.

design.md gaps discovered:
- No rule for how a long, locale-formatted currency amount behaves inside a
  fixed-size chart centre. Resolved with a size step-down and recorded.

Rule changes proposed:
- Verify charts with realistic magnitudes, not toy values, and verify them after
  any resize.

Rules validated:
- No text in the graphics layer; text equivalents in the accessible label.
- Motion helpers only.

Rules superseded:
- None.

### 2026-09-24 — Reconcile — Phase 6 (rows, states, shells, navigation)

Worked:
- Composing states and shells from existing primitives with no new primitives.
- Extending an existing component with an optional prop whose default preserved
  current rendering, covered by tests.
- Adding an opt-out for the shell's own scrolling so the shell could be embedded
  inside a gallery's scroller.

Didn't work:
- A single-row header at narrow width: the two-part heading was squeezed and
  broke mid-word.

Agent-as-user pass caught (that tests did not):
- The header overflow.
- A shell that collapsed when nested inside an outer scroll container — an
  embedding defect invisible in isolation.
- A deprecated web-only shadow API, from the console.

design.md gaps discovered:
- Whether the scaffold header is one row or two. The design doc had a
  two-row example on another screen; the implementation matched it.

Rule changes proposed:
- Verify a component in its real host context, not only in isolation.

Rules validated:
- Additive, optional, defaulted props over new components.
- Scroll opt-out as a general shell capability.

Rules superseded:
- None.

### 2026-09-25 — Reconcile — Phase 7 (feature organisms)

Worked:
- Organisms as pure compositions of existing primitives, with no data fetching
  of their own.
- Conditional refinements to a primitive (an opt-out, a size step-down) that
  were backward compatible and kept every existing test green.

Didn't work:
- A chart that rendered its own internal legend **and** sat inside a card that
  rendered its own. The duplicate was obvious once seen, and one of the two
  legends was invisible because its swatch matched the card behind it.
- Long, realistic amounts overflowed the chart centre and clipped at the card
  edge.

Agent-as-user pass caught (that tests did not):
- Both of the above. The unit tests rendered the component in isolation and were
  green throughout.

design.md gaps discovered:
- Again, the long-amount behaviour in a fixed-size chart centre. This was the
  second phase to hit it, which promoted it from an incident to a rule.

Rule changes proposed:
- The legend belongs to whichever layer the design places it in — once.

Rules validated:
- Organisms as pure compositions.
- Backward-compatible primitive refinement over a new component.

Rules superseded:
- None.

### 2026-09-26 — Reconcile — Phase 7 (first device pass)

Worked:
- Getting a real installable build onto a device, and treating the device walk
  as the phase's verification instrument.
- Adding a narrow-width stress section to the gallery covering long values,
  wrapping rows, long labels, and extreme numbers.

Didn't work:
- Assuming a web pass covers layout. It does not, and on this project it never
  did.

Agent-as-user pass caught (that tests did not):
- A container that was neither padded nor scrollable: content was clipped at
  the edges and part of a list was simply unreachable. No test rendered at that
  width with real values.

design.md gaps discovered:
- None. This was a structural omission in a screen, not a specification gap.

Rule changes proposed:
- Add a narrow-width stress pass to the gallery **before** shipping a device
  build. Adopted in this same phase.

Rules validated:
- Dual-surface verification is not optional. The first device pass found
  something the entire web campaign had missed.
- A device pass must be a walk, not a launch test.

Rules superseded:
- None.

### 2026-09-26 — Reconcile — Phase 8 (screen rebuilds)

Worked:
- Rebuilding screens to a fixed per-screen contract — real bindings, three
  states, reduced-motion path, labels, screenshot, user pass.
- Wiring the floating navigation to the router for the first time, and
  documenting a deviation where the literal mapping in the plan would have
  stranded a tab.

Didn't work:
- Assuming an embedded relation is always an array. An absent field
  dereferenced to nothing and crashed a screen on first paint.
- Applying a filter meant for one total to a different total, which zeroed a
  headline figure permanently and looked plausible.

Agent-as-user pass caught (that tests did not):
- The crash, and the permanently-zero figure beside it.
- A greeting wrapping to three lines and an action splitting across two.
- A blank first paint in screenshots that turned out to be a capture-timing
  artifact — investigated, disproved, and recorded as an acquittal rather than
  "fixed."

design.md gaps discovered:
- Nothing visual. The zeroed figure was a binding bug, but it exposed a rule
  worth writing down: a derived total must not inherit a filter intended for a
  different total.

Rule changes proposed:
- State the eligibility rule for every derived figure at the point it is
  introduced.

Rules validated:
- The per-screen delivery contract.
- Reading the caller rather than assuming a component is unused.

Rules superseded:
- None.

### 2026-09-26 — Reconcile — Phase 8 (native crash)

Worked:
- A development client. The stack trace named the exact function and the exact
  failure in under a minute.
- Auditing **all** animation call sites after one was found, not only the one
  that crashed.
- A static test that gates the animation compiler plugin's presence, proven to
  fail when the plugin is removed.

Didn't work:
- Iterating through release builds. The same class of failure would have taken
  many cycles and produced no stack trace.
- The animation compiler plugin was missing entirely, so the failure mode had
  no warning of any kind — nothing but the crash.

Agent-as-user pass caught (that tests did not):
- A UI-thread callback synchronously calling ordinary application helpers. Green
  on web, fatal on device. The entire suite passed.

design.md gaps discovered:
- None.

Rule changes proposed:
- Any function reachable from a UI-thread callback must itself be marked as one.
- Gate the animation compiler plugin's presence statically.
- Use a development client for diagnosis; use a release build for verification,
  never for diagnosis.

Rules validated:
- Dual-surface verification, at the strongest level yet: this class is
  invisible to the web target entirely.

Rules superseded:
- None.

### 2026-09-27 — Reconcile — Phase 9 (remaining screens)

Worked:
- The same contract, applied uniformly, including to the error and not-found
  paths rather than only the happy paths.
- Adding one mutation for an update path that previously had no code path at
  all, because the screen needed it.

Didn't work:
- Relying on a platform-specific text-fitting API for a cross-platform layout
  problem. It works on one platform only; the other needs a real typographic
  decision.
- Rendering a string that the backend already prefixed, producing a doubled
  prefix in the interface.

Agent-as-user pass caught (that tests did not):
- Paired figures ellipsized by the platform's shrink-to-fit behavior.
- The doubled prefix — a contract mismatch between layers that no test spanned.
- A long identifier breaking mid-word.

design.md gaps discovered:
- None. The typographic fix was a size decision the design doc already implied.

Rule changes proposed:
- Fix duplication at the layer that owns the value, not in the view.
- Never rely on a single-platform fitting API for a two-platform layout.

Rules validated:
- Uniform application of the delivery contract, including to error paths.
- Extending a screen's data layer when the screen legitimately needs a new
  operation.

Rules superseded:
- None.

### 2026-09-27 — Reconcile — Phase 10A (full web audit)

Worked:
- Auditing every screen at both viewports in one pass, against the design doc,
  both anti-pattern lists, and a measured accessibility sweep.
- The **acquittal list**: recording the things investigated and cleared, and
  separating them from the things found.
- Reporting one mandated contrast failure as a known residual with its measured
  ratio and the clause that mandates it, rather than quietly correcting the
  value.
- Deferring a named list of non-blocking items instead of expanding scope.

Didn't work:
- Assuming a chart's axis labels inherit a legible colour on a dark surface.
  They did not; they rendered ink-on-ink.
- A screen shipping without its primary action — a blocks-loop defect that no
  component or unit test could see, because the test asserted what was there,
  not what was required.

Agent-as-user pass caught (that tests did not):
- Twelve changes across five categories: one blocks-loop, several visual,
  several accessibility (target sizes below the minimum, text links too short
  to tap, invisible axis labels), and a design violation where a dark surface
  spilled to a light background below the fold, making lower content invisible
  in the browser only.
- A character rendering that looked like a glyph bug and was proved, at 4×
  magnification, to be font anti-aliasing on a correctly supported codepoint.

design.md gaps discovered:
- The over-budget state of a progress indicator — fill colour and whether the
  displayed percentage is capped — was unspecified. Amended in the design
  document, and it is the only design edit this phase made.
- Behaviour of a dark surface when content exceeds the viewport.

Rule changes proposed:
- A design-document amendment is a legitimate phase deliverable when the design
  is genuinely silent. Record it as a design gap, with a reason, in the phase
  record — not as an implementation fix.
- The acquittal list is part of a complete pass.

Rules validated:
- Measuring accessibility rather than judging it.
- Deferring by name instead of expanding scope.
- Finishing with a second pass on a fresh build with fresh sessions.

Rules superseded:
- None.

### 2026-09-30 — Reconcile — Phase 10A.5 and 10B (device-driven fixes)

Worked:
- Measuring the suspected defect instead of theorizing: a field believed to be
  failing to save was saving correctly and sitting below the fold.
- Exporting the navigation bar's own height from the component that owns it, so
  the space reserved for it and the space it occupies cannot drift apart.
- Writing a narrow mutation that writes one column and nothing else, with tests
  asserting the other side effects do **not** occur.
- Choosing a visible affordance over an invisible gesture, and recording the
  reasoning and the rejected alternative in the phase record rather than
  building both.
- A design-document amendment for a progress-bar variant, again recorded as a
  design gap.

Didn't work:
- Disabling a header that the framework draws on web, which fixed that surface
  and removed a native affordance on the device — one commit, one fix, two
  platforms, opposite outcomes.
- Platform layout defaults again: horizontal overflow on the device that the web
  pass reported as clean, at three separate sites.
- A percentage label anchored to a progress fill with an implicit minimum, which
  could not render at a 1% ratio.

Agent-as-user pass caught (that tests did not):
- Header chrome wrong on one platform and its affordance missing on the other.
- Header controls that were present, labelled, and completely non-functional.
- Three separate horizontal-overflow sites on the device only.
- Content below the fold on several screens, and the derived bottom padding that
  caused it.
- An image that displayed as broken until the fallback path was built.
- A progress indicator capped at 100% while its label showed the true value —
  internally inconsistent by construction.
- A label that a save operation did not update.

design.md gaps discovered:
- The over-budget progress variant, again — this time as fill colour and label
  wording. Recorded as a gap and amended, the second and last time.

Rule changes proposed:
- Export layout constants from the component that owns them, so reserved and
  rendered values share one source.
- Any overlay anchored to a proportional fill needs a floored anchor zone
  expressed as a ratio (§9, rule 5).
- Read the callee before reusing a helper (§9, rule 6).

Rules validated:
- A device pass finds a distinct defect class, every time it has been run.
- One coherent group of fixes per release build.
- Recording the rejected alternative alongside the chosen one.

Rules superseded:
- "Disabling the framework header fixes the chrome everywhere." Superseded by
  §9, rule 7.

### 2026-09-30 — Reconcile — Phase 10B.5 (data consistency + a period control)

Worked:
- Writing the two definitions side by side in a table — call site, helper, field
  read, treatment of credits, date basis, filters — before touching anything.
  The mismatch was obvious in the table and invisible in both screens.
- Keeping the semantically correct definition and deduplicating the call, rather
  than changing the definition to match the more convenient one.
- A parity test asserting the new shared helper equals the old engine's output
  on the same rows and window.
- Representing the selected period as an **offset**, not a date, so the default
  stays live instead of freezing at mount.
- Verifying the demo dataset actually spanned multiple periods before changing
  the seed — and correctly changing nothing.

Didn't work:
- The shared-helper illusion (§9, rule 1): identical calls, different fields.
- Two date bases for the same month (§9, rule 2).
- A period selector that had been an optional prop on a component for several
  phases with **no caller**, so it rendered, was correctly styled and sized, and
  did nothing. Found by reading the caller, not by testing the component.

Agent-as-user pass caught (that tests did not):
- The figure mismatch, found only by opening two screens and comparing the same
  number for the same period.
- The inert control.
- A month-stepping helper that would have shifted a period label by a whole
  month on the 29th–31st, caught by reading the arithmetic rather than by running
  the UI on those dates.

design.md gaps discovered:
- Nothing. This phase was entirely a correctness fix.

Rule changes proposed:
- Two-screen side-by-side reading becomes a standing step in the pass protocol
  whenever two surfaces present the same quantity (§10).
- State period selection as an offset, not a date.

Rules validated:
- Measuring a suspicion before fixing it (§7.3).
- Verifying the seed before changing it.
- Reading the caller, not the prop list.

Rules superseded:
- None.

### Not yet earned — pending a future cycle

These are recorded because they are in the project plan and remain plausible,
but this project has not yet produced evidence either way. They are rules the
plan asserts and the build has not tested:

- Rendering correctly at large OS font settings. No font-scale test was ever
  run. **Inherited — pending validation.**
- Safe-area behaviour on notched or gesture-bar devices. Only one device form
  factor was used. **Inherited — pending validation.**
- Behaviour on a second mobile platform. Every native pass was on one platform.
  **Inherited — pending validation.**
- Sub-minimum touch targets measured on hardware. Measurements were taken
  programmatically against a browser rendering; the device confirmations were
  operator-reported. **Inherited — pending validation.**

A future version of this file should promote, amend, or delete each of these
the first time a cycle produces evidence.

---

## 13. Adoption

1. Copy this file to the target repository root.
2. Reference it in the agent rules, under the UI rules, with one line:
   *Follow the design document, the frontend implementation plan, and the
   frontend-design skill for all frontend work, including agent-as-user
   browser verification.*
3. Identify the equivalents of the sections below and point this file at them.
   The rules are portable; the paths are not.
   - Single token layer and its mechanical enforcement check → §3.
   - Design document and its amendment procedure → §4.
   - Motion helpers and the reduced-motion switch → §5.
   - Deployment target and its secret-scan step → §8.
   - Phase record with per-phase commit hashes and evidence → §12.
4. Record whether the agent has browser or device capability, and where that
   capability lives. If it has none, §7.6 is the operating mode from day one,
   not an exception discovered late.
5. **Do not adopt this file's principles as proven before this project has
   earned them.** Copy it; then change it. Every phase appends an entry to §12,
   and rules that this project has not exercised are marked above as inherited
   or not-yet-earned — carry those marks forward rather than laundering them
   into rules. A skill that starts as theory must be visibly corrected by
   evidence before it is trusted.
6. Do not modify §1–§11 mid-project. Only §12 is appended to, and only §12 may
   justify a change to a rule — and when it does, the rule changes first and the
   code changes after, never the reverse.
7. Version discipline: v1 is written after the first screen completes the full
   dual-surface cycle. Rewrite as v2 after a full set of screens has been
   deployed, reviewed by a human, and fixed. Version numbers track evidence, not
   elapsed time.
