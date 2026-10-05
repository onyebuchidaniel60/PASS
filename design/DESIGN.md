# PASS — Design Blueprint

**Status:** Visual and interaction source of truth for the PASS frontend.
**Applies to:** Stage K of `docs/IMPLEMENTATION_PLAN.md`, executed after the one-shot build per `docs/DECISIONS.md` D-017.
**Governed by:** `SKILL_FRONTEND_DESIGN.md` at the repository root.
**Behaviour authority:** `docs/UX_SPEC.md` and `docs/PRODUCT_PRD.md`. Where this document and the UX spec disagree, the UX spec wins and this document is wrong.

This document describes **how PASS looks and behaves in the browser**. It does not define product behaviour, endpoints, or lifecycle rules. Where a visual decision requires a product answer the PRD does not give, the decision is left open and listed in §13 rather than invented here.

---

## 1. Design principles and tone

### 1.1 Principles

1. **Proof over promise.** Every number shown must be traceable to something PASS or a named provider actually knows. If it cannot be attributed, it is not rendered.
2. **One object per screen.** A Pass is a single deliberate object of consequence, not a row in a feed. The Pass page is a document, not a card grid.
3. **Risk is always visible.** Entry, TP, SL, leverage, expiry, and current market price are never behind a disclosure, hover, or tab.
4. **Separation stays visible.** PASS performance and Hyperliquid account performance are separate data categories and are never merged into one figure or one label (D-014, PRD §13). Ethos reputation is never merged with trading performance into a trust score (D-007, PRD §12).
5. **The Taker is the author of their own execution.** The Taker's position size is entered by the Taker and is never pre-filled from the Trader's size (D-015, UX_SPEC §8).
6. **Statement over sentence.** Copy is declarative and short. Data is stated, not celebrated.
7. **The interface is infrastructure.** It should feel like verified machinery. Not a casino, not a fintech app, not a dashboard template.

### 1.2 Tone

Industrial-editorial. Precise, calm, and slightly severe. Closer to a technical document or an audited instrument panel than to a marketing site.

- **Calm under failure.** Errors state what happened and what to do next. No exclamation marks, no apology, no "oops".
- **No urgency theatre.** No countdowns, no "12 people are taking this now", no scarcity language.
- **No celebration.** A profitable Pass does not get a trophy, a confetti, or a colour change. It gets a number.
- **Warmth is allowed only in language.** The palette is cold-neutral; the writing may be plain and human.

### 1.3 Copy register

The hero line is fixed by PRD §18 and UX_SPEC §4:

> See a trade. Know the trader. Take the trade.

Support line:

> PASS turns Hyperliquid trade plans into shareable, executable links.

Section headers are short and declarative: `The plan.`, `What the market says.`, `Who is taking it.`, `Authorization.` — not `Understanding the Trade Plan Parameters`.

**Forbidden copy shapes** are listed in §12.4.

---

## 2. Color system

### 2.1 Structure

The palette is dark-first and near-monochrome. Exactly one saturated hue exists in the system — the **ember accent** — plus a strictly subordinate positive/negative pair reserved for price data. Every other surface is a neutral grey.

Semantic tokens are the only values components may reference. Primitive values below are exposed as tokens too, so no component ever needs a raw hex.

### 2.2 Base and surfaces

| Token | Hex | Use |
|---|---|---|
| `--color-void` | `#050505` | Page background behind everything; deepest inset |
| `--color-canvas` | `#0A0A0A` | Default page surface. Never pure black |
| `--color-surface` | `#101013` | Cards, panels, table rows, inputs |
| `--color-surface-raised` | `#16161A` | Hover on surface, popovers, dialogs |
| `--color-surface-sunken` | `#08080A` | Inset wells: chart areas, code/data blocks, table headers |
| `--color-scrim` | `rgba(5, 5, 5, 0.72)` | Modal/dialog backdrop |

Surfaces step by lightness, never by shadow. Elevation on dark is expressed as a lighter surface plus a hairline border.

### 2.3 Borders and lines

| Token | Hex | Use |
|---|---|---|
| `--color-line-hairline` | `#1F1F25` | Default 1px rules, panel borders, table dividers |
| `--color-line-strong` | `#656577` | Emphasised dividers, input borders, hovered row borders |
| `--color-line-grid` | `#141418` | Background column/row grid lines (structural, not decorative) |

### 2.4 Text

| Token | Hex | Contrast on `--color-canvas` | Use |
|---|---|---|---|
| `--color-text-primary` | `#F5F1EA` | 17.6:1 | Headlines, primary body, primary data |
| `--color-text-secondary` | `#B4AEA4` | 8.9:1 | Body copy, descriptions, labels |
| `--color-text-tertiary` | `#8A857C` | 5.4:1 | Eyebrows, timestamps, captions, metadata |
| `--color-text-disabled` | `#5C5852` | 2.6:1 | Disabled controls only. Never load-bearing text |
| `--color-text-on-accent` | `#0A0A0A` | 5.6:1 on accent | Text inside an accent-filled control |

Text is warm off-white, never pure `#FFFFFF`, so it sits on the near-black base without vibrating.

### 2.5 The ember accent

The single saturated colour in the system.

| Token | Hex | Use |
|---|---|---|
| `--color-accent` | `#F03A1C` | Primary CTA fill, active states, the signal line, focus ring |
| `--color-accent-hover` | `#FF4A2C` | Hover on accent-filled controls |
| `--color-accent-active` | `#D0300F` | Pressed on accent-filled controls |
| `--color-accent-text` | `#FF5533` | Accent used as **text or hairline** on dark surfaces (5.9:1) |
| `--color-accent-muted` | `rgba(240, 58, 28, 0.12)` | Selected row tint, active nav item background |
| `--color-accent-edge` | `rgba(240, 58, 28, 0.35)` | Accent hairline on a panel top edge |

**Rules for the accent — it is rationed:**

- The accent marks **one thing per viewport**: the single primary action, or the single element under discussion.
- The accent may mark: the primary CTA, an active navigation item, a focus ring, the signal line, the Lifecycle-change marker, the required-field marker, and the eyebrow `//` `\\` delimiters.
- The accent may **not** mark: section headings, ordinary links, body text, icons in lists, table row striping, avatars, or anything that would put more than roughly 5% of a viewport's pixels into a saturated hue.
- **`--color-accent` is never a data-direction colour.** Up and down movement is expressed only by the §11.4 pair.

### 2.6 Price-data pair

Strictly subordinate to the accent. Never used decoratively, never used on a non-data surface, never used to fill a control.

| Token | Hex | Contrast on `--color-canvas` | Use |
|---|---|---|---|
| `--color-data-positive` | `#46C08C` | 8.7:1 | Positive PnL, price up, favourable delta |
| `--color-data-negative` | `#E2554F` | 5.3:1 | Negative PnL, price down, unfavourable delta |
| `--color-data-neutral` | `--color-text-secondary` | 8.9:1 | Flat, unchanged, not applicable |

These three are visibly less saturated than the ember and are always accompanied by a sign glyph (`+` / `−`) or a directional arrow. **Colour is never the sole carrier of direction** (UX_SPEC §12).

### 2.7 Light / dark behaviour

**PASS ships dark-only.** There is no light theme in the MVP and no theme toggle.

The token layer is nonetheless structured so a light theme is purely additive: every semantic token above resolves to a primitive, and no component references a primitive directly. Adding `light` later means supplying an alternate value per semantic token, not restyling components.

Supplying actual light-mode values is **out of scope and recorded as a gap (G-1, §13.1)**. Do not derive light values by inverting the dark palette; that produces the "dark surface spilling onto a light page" defect.

### 2.8 Colour is never load-bearing alone

Every status, direction, and state below must carry a second, non-colour signal:

| Meaning | Colour | Required second signal |
|---|---|---|
| Pass lifecycle state | Accent or neutral | Uppercase text label (mandatory) |
| PnL up / down | Data positive / negative | `+`/`−` sign or ▲/▼ glyph |
| Field valid / invalid | Accent / data-negative | Text message + `aria-invalid` |
| Verified / not verified | Data positive / tertiary | Text label + icon |
| Live / stale data | Accent / tertiary | `LIVE` / `STALE` text + timestamp |

---

## 3. Typography system

### 3.1 Families

Three families. Data is never set in a body face; headlines are never set in a data face.

| Role | Family | Weights loaded | Fallback stack |
|---|---|---|---|
| Display | **Archivo** | 500, 600, 700 (variable width/weight axis if available) | `Archivo, "Helvetica Neue", Arial, sans-serif` |
| Body | **Inter Tight** | 400, 500, 600 | `"Inter Tight", Inter, "Helvetica Neue", Arial, sans-serif` |
| Data | **IBM Plex Mono** | 400, 500, 600 | `"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace` |

**Anti-reference discipline.** These families are chosen specifically because they are *not* the reference's families. Per `SKILL_FRONTEND_DESIGN.md` §4, do not lift the type family used in `design/references/`. Every weight listed must be loaded explicitly as its own face; a single family name covering several weights is a known defect (skill §12, Phase 3).

All three are self-hosted. No runtime font CDN. Font loading is verified by rendered pixels, not by a resolved family string.

### 3.2 Roles

| Role | Family | Used for |
|---|---|---|
| Display | Archivo | Hero, screen titles, section headlines, large statement figures |
| Body | Inter Tight | Paragraphs, thesis text, labels, helper text, buttons, nav |
| Data | IBM Plex Mono | Every price, size, PnL, entry/TP/SL, leverage, timestamp, address, hash, Pass id, status chip, eyebrow, and axis label |
| Eyebrow | IBM Plex Mono, uppercase, tracked `+0.18em` | Section eyebrows and section numbers |

### 3.3 Size steps

Steps are named, not numbered. Every value below is a token.

| Token | Size / line-height | Tracking | Family | Typical use |
|---|---|---|---|---|
| `--type-display-xl` | `clamp(2.5rem, 1.4rem + 4.4vw, 4.5rem)` / `1.02` | `-0.030em` | Display | Landing hero only |
| `--type-display-l` | `clamp(2rem, 1.4rem + 2.4vw, 2.75rem)` / `1.06` | `-0.026em` | Display | Screen title, Pass asset line |
| `--type-display-m` | `2.125rem` / `1.12` | `-0.022em` | Display | Section headline |
| `--type-title-l` | `1.5rem` / `1.25` | `-0.015em` | Display | Panel title, Pass name |
| `--type-title-m` | `1.1875rem` / `1.26` | `-0.010em` | Display | Card title, drawer title |
| `--type-title-s` | `1rem` / `1.25` | `0` | Display | Field group legend |
| `--type-body-l` | `1.0625rem` / `1.53` | `0` | Body | Lead paragraph, thesis |
| `--type-body-m` | `0.9375rem` / `1.47` | `0` | Body | Default body, nav, button label |
| `--type-body-s` | `0.8125rem` / `1.38` | `0` | Body | Helper text, secondary meta |
| `--type-data-xl` | `2.5rem` / `1.0` | `-0.020em` | Data | Hero metric figure |
| `--type-data-l` | `1.75rem` / `1.14` | `-0.015em` | Data | Pass price, headline PnL |
| `--type-data-m` | `1.1875rem` / `1.26` | `-0.010em` | Data | Table price, coordinate value |
| `--type-data-s` | `0.9375rem` / `1.33` | `0` | Data | Inline data, chip, label value |
| `--type-data-xs` | `0.75rem` / `1.33` | `0` | Data | Timestamp, caption, axis label |
| `--type-eyebrow` | `0.6875rem` / `1.27` | `+0.180em` | Data | Section eyebrow, section number |
| `--type-label` | `0.75rem` / `1.33` | `+0.060em` | Data | Uppercase field label, table header |

### 3.4 Rules

- Display type is tight-tracked and set flush left. Never centred except the landing hero.
- Body measure is capped at **68ch**; thesis text at **62ch**.
- Data uses `font-variant-numeric: tabular-nums` everywhere, so digits align in columns and a changing value does not reflow its neighbours.
- Eyebrows are uppercase, monospace, and framed by ember delimiters in the form `// SECTION NAME \\`. The section number (`// 04 \\`) sits at the opposite edge of the same row. The delimiters are the only place the accent touches a heading.
- Line length for `--type-display-xl` is capped at 18ch so the hero never runs to three lines on desktop.
- All font sizes are `rem`. All letter-spacing is `em`.
- No text is set below `--type-data-xs` (12px) except the browser-visible extension badge, which is not part of this scale.

---

## 4. Spacing scale

A single 4px-based scale. No value outside this scale appears in any component.

| Token | Value | Typical use |
|---|---|---|
| `--space-0` | `0` | Reset |
| `--space-1` | `4px` | Icon-to-label gap, chip padding-y |
| `--space-2` | `8px` | Inline gap, chip padding-x |
| `--space-3` | `12px` | Tight stack, table cell padding-y |
| `--space-4` | `16px` | Form field gap, list item padding |
| `--space-5` | `24px` | Panel padding (mobile), stack between blocks |
| `--space-6` | `32px` | Panel padding (desktop), between major blocks |
| `--space-7` | `48px` | Section inner rhythm, card grid gap |
| `--space-8` | `64px` | Section separation |
| `--space-9` | `96px` | Section separation (desktop, major) |
| `--space-10` | `128px` | Hero vertical padding |

**Vertical rhythm.** Sections are separated by `--space-8` on mobile and `--space-9` on desktop. Inside a section, blocks are separated by `--space-6`. Inside a panel, blocks are separated by `--space-5`. Inside a form, fields are separated by `--space-4`.

Content breathes. If a screen feels cramped at desktop width, the fix is more space, not smaller type.

---

## 5. Radii, borders, and elevation

### 5.1 Radii

The system is nearly square. Large radii read as consumer-app and are prohibited.

| Token | Value | Use |
|---|---|---|
| `--radius-none` | `0` | Panels, tables, sections, the Pass object |
| `--radius-sm` | `2px` | Inputs, chips, badges |
| `--radius-md` | `4px` | Buttons, popovers, tooltips, dropdowns |

**No radius above `--radius-md` (4px) anywhere in the product.** This is a hard rule, not a preference.

### 5.2 Corner-bracket framing

The signature frame. Panels that carry a single important object — the Pass object, the execution review, hero panels — are **chamfered**, not rounded:

- Implemented as a `clip-path` with a `--chamfer-size` of `10px` on the top-left and bottom-right corners.
- `--chamfer-size` is a token. It is never inlined.
- Chamfered panels are always `--radius-none` in the token sense; the chamfer replaces the radius.
- Chamfer is a framing device only. It is never combined with a drop shadow.

Chamfer is used on at most one panel per viewport region, and never on more than three panels on a single screen.

### 5.3 Borders

- Default border: `1px solid var(--color-line-hairline)`.
- Input and focused-container border: `1px solid var(--color-line-strong)`. This token was **amended** from `#2C2C34` to `#656577`; see §2.3.1 for the derivation and the measurement that forced it.
- Accent edge on a key panel: `1px solid var(--color-accent-edge)` on the **top edge only**, as an inset box-shadow or border-top.
- Focus ring: `2px solid var(--color-accent)` with `2px` offset, always paired with a visible change of surface so it survives forced-colors mode.
- Structural dividers inside dense data regions (`--color-line-hairline`) may be used to group rows. Row striping is prohibited.

A border that identifies a control is a UI component boundary and must meet the
3:1 non-text minimum. A border that only separates content is decorative and is
exempt. `--color-line-strong` is the first kind; `--color-line-hairline` is the
second.

#### 2.3.1 Amendment record — `--color-line-strong` (gap G-15, 2026-10-06)

The original value `#2C2C34` was specified for use as the input and
focused-container border in §5.3. Measured against `--color-surface`
(`#101013`) it resolves to **1.37:1**, which fails the 3:1 minimum that
`design/FRONTEND_IMPLEMENTATION_PLAN.md` §4.4 sets for UI component boundaries.
A 1px line at that ratio does not identify its control. The defect was in this
document, not in any implementation: no value in the §2.3 line ramp reached 3:1,
the darkest candidate that did being a text token at 5.18:1, which would have
made every input border read as body text.

**Derivation.** `#2C2C34` (44, 44, 52) was scaled uniformly by 2.29, preserving
its slight blue tint, giving `#656577`. A uniform scale was used so the token
stays on the same neutral ramp rather than introducing a new hue, and a margin
above the threshold was targeted rather than the exact edge, so the value cannot
tip below the minimum through rounding or a slightly different surface.

**Measured result**, computed with the WCAG 2.1 relative-luminance formula by
`scripts/check-contrast.mjs`:

| Against | Ratio | Minimum | Result |
|---|---|---|---|
| `--color-surface` `#101013` | **3.33:1** | 3:1 | PASS |
| `--color-canvas` `#0A0A0A` | **3.47:1** | 3:1 | PASS |
| `--color-surface-sunken` `#08080A` | **3.51:1** | 3:1 | PASS |
| `--color-surface-raised` `#16161A` | **3.16:1** | 3:1 | PASS |

All four PASS was checked because an input may sit on any of them.

This amendment was made under `SKILL_FRONTEND_DESIGN.md` §9 rule 9, which
requires a design-mandated value that fails a stated standard to be measured,
reported with its ratio, escalated rather than silently corrected in code. The
value was changed here, in the design document, as a logged act — not patched in
the token layer to make a check pass.

### 5.4 Elevation

Elevation is expressed **only** as a step up in surface lightness plus a hairline border. There is no shadow-based elevation on dark surfaces.

The single exception is the **overlay tier** — dialog, bottom sheet, popover, toast:

- Backdrop: `--color-scrim`.
- Surface: `--color-surface-raised` with a `--color-line-strong` border.
- One shadow token, `--shadow-overlay`, permitted **only** on this tier: `0 24px 48px rgba(0, 0, 0, 0.64)`.

`--shadow-overlay` on any non-overlay component is an anti-pattern (§12.1).

---

## 6. Motion system

### 6.1 Principles

Motion is a system with a stated purpose per use, not a per-component decision. Every animation declares one of three purposes:

- **orient** — the user changed where they are or what is now visible.
- **confirm** — the user's action was accepted.
- **explain** — a state changed for a reason the user needs to follow.

Motion that is only decorative is removed.

### 6.2 Durations

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | `0ms` | Reduced-motion target for transforms |
| `--duration-fast` | `120ms` | Press feedback, chip and toggle transitions |
| `--duration-base` | `180ms` | Fade-in of content, tooltip, dropdown |
| `--duration-slow` | `260ms` | Drawer, sheet, route transition |
| `--duration-deliberate` | `420ms` | Hero signal-line reveal only. Cap for the whole system |

**Nothing exceeds `--duration-deliberate` (420ms). Nothing loops.** There is no infinite animation anywhere in PASS, including skeleton loading states — a skeleton uses a static sunken surface with an accent hairline, not a travelling shimmer.

### 6.3 Easings

| Token | Value | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default for orient and explain |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Exit and dismiss |
| `--ease-linear` | `linear` | Data only: progress fill, count-up on a live figure |

### 6.4 Motion inventory

| Purpose | Trigger | Behaviour | Duration |
|---|---|---|---|
| orient | Route change | Opacity `0 → 1`, `translateY(8px → 0)` | `--duration-slow` |
| orient | Drawer / bottom sheet | `translateX/Y` from the edge + opacity | `--duration-slow`, `--ease-exit` on close |
| orient | Collapsible section (Pass plan detail) | `grid-template-rows` `0fr → 1fr` + opacity | `--duration-base` |
| orient | Signal line reveal (hero only) | Horizontal scale `0 → 1` from left, once | `--duration-deliberate` |
| confirm | Primary CTA press | `scale(1 → 0.98)` | `--duration-fast` |
| confirm | Take Pass accepted | Opacity `1 → 0.6 → 1` on the CTA label plus a single accent edge sweep across the panel | `--duration-base` |
| confirm | Copy-to-clipboard | Icon swap, no movement | `--duration-fast` |
| explain | Lifecycle state advance | Old chip fades out, new chip fades in; no slide | `--duration-base` |
| explain | Loading → content | Cross-fade only | `--duration-base` |
| explain | Inline validation message | Opacity + `translateY(-4px → 0)` | `--duration-fast` |

### 6.5 Press feedback

Press feedback is part of the component contract, not per-screen work. Every interactive primitive has a defined pressed state, verified by computed style after the press rather than by eye.

### 6.6 Reduced motion

When `prefers-reduced-motion: reduce` is set:

- All `--duration-*` tokens except `--duration-fast` resolve to `0ms`.
- Every transform-based animation (translate, scale, chamfer sweep) is removed entirely, not shortened.
- Opacity cross-fades are retained but capped at `--duration-fast` (120ms).
- The signal line renders in its final state immediately, with no sweep.
- No element moves. Nothing loops.

Every screen is verified with reduced motion forced on. A screen that only works with motion on is not done.

### 6.7 Haptics

Not applicable. PASS is a web application and a Chrome extension; there is no haptics surface in the MVP. No haptic vocabulary is defined, and none may be introduced without a design amendment.

---

## 7. Iconography

### 7.1 Construction

- **20×20px** design grid, 16px optical size for inline use.
- **1.5px** stroke, square line caps, square/miter joins.
- Icons inherit `currentColor` and the size token of their context. Icon colour is never hard-coded.
- Icon-only controls have a minimum hit area of `--size-target-min` (44×44px) regardless of the glyph's optical size.

### 7.2 Required glyphs

| Name | Meaning | Where |
|---|---|---|
| `reticle` | Locate / pinpoint | Signal line node, coordinate pairs, hero |
| `signal-line` | The recurring device: beam, scanline, price line | Hero, Pass panel divider, loading wells |
| `bracket-tl` / `bracket-br` | Corner-bracket frame | Hero and key panels |
| `arrow-up-right` | External link, X share | Share row, reputation links |
| `chevron-down` / `chevron-right` | Disclosure, expand | Collapsible sections |
| `clock` | Expiry, timestamp | Pass header, plan block |
| `link-x` | X identity | Trader block |
| `shield-check` | Ethos reputation context | Trader block |
| `wallet` | Hyperliquid connection | Onboarding, execution |
| `check` | Confirmed, authorized | Success states |
| `alert-triangle` | Warning, stale | Stale indicator, validation |
| `x-circle` | Rejected, failed | Error states, execution rejected |
| `copy` | Copy link / address | Share row |
| `plus` | Add / create | Create Pass CTA, stat blocks |
| `minus` | Negative delta | PnL cells |
| `arrow-up` / `arrow-down` | Directional delta | PnL cells |

### 7.3 Rules

- No emoji, anywhere, in any surface, including extension UI and empty states.
- No filled decorative icon sets, no duotone, no 3D, no illustration-style glyphs.
- No brand marks except: the X logo (for X links, in X's own brand colour, never the ember) and the Hyperliquid wordmark. Both are used as links, never as decoration.
- A glyph is never the only carrier of meaning; every icon-only control has an accessible name and, where the meaning is not obvious, an adjacent text label.
- No custom logo mark is designed by this document. PASS wordmark treatment is **gap G-2 (§13.1)**.

---

## 8. Grid and layout

### 8.1 Breakpoints

| Name | Range | Behaviour |
|---|---|---|
| Mobile | `0 – 767px` | Single column. Bottom navigation. 16px gutter |
| Tablet | `768 – 1023px` | Single or two column. Sidebar may collapse to a rail. 24px gutter |
| Desktop | `1024 – 1439px` | 12 columns. Persistent sidebar. 24px gutter |
| Wide | `1440px+` | 12 columns, content locked at max width, surplus space distributed |

### 8.2 Grid rules

- **12 columns.**
- **Gutter: 24px** on tablet and above; **16px** on mobile.
- **Outer margin: 20px** on mobile, **40px** on tablet, **80px** on desktop — but the content box is capped so the margin never falls below 80px on desktop.
- **Max content width: 1280px.** The grid is centred above this.
- Column width is derived from the container. It is never hard-coded.
- Background column rules (`--color-line-grid`) may be drawn behind a hero section at the same column positions. They are structural. They are never drawn behind body content and never drawn as a decorative overlay on top of text.

### 8.3 Named regions

| Region | Desktop span | Mobile |
|---|---|---|
| Page gutter | full | full |
| Sidebar | 240px fixed, outside the 12 columns | replaced by bottom nav, 56px + safe-area |
| Content | columns 1–12 | full width |
| Content (reading) | columns 1–7 | full width |
| Content (aside) | columns 9–12 | stacked below content |
| Pass object | columns 2–11, centred | full width |
| Form measure | columns 1–7 | full width |

### 8.4 Navigation shells

- **Public shell:** sticky top bar, 64px, hairline bottom border, transparent over the landing hero until scrolled.
- **Authenticated shell (desktop):** fixed 240px left sidebar, content offset by 240px. Sidebar exports its own width as a token so reserved and rendered space cannot drift (skill §9, rule 10 / Phase 10B lesson).
- **Authenticated shell (mobile):** fixed bottom navigation, 56px tall plus `env(safe-area-inset-bottom)`. Content carries bottom padding equal to the nav's exported height plus `--space-6`, so the last element is never occluded. The reserved clearance is measured, not assumed.
- Every scrolling region is a flex child with `min-height: 0` and `min-width: 0`, so a wide child cannot force the page to overflow.

### 8.5 Overflow discipline

- No element may exceed the viewport horizontally at any breakpoint. This is asserted by measurement.
- Long values (addresses, asset names, theses, Pass ids) **shrink and truncate with an explicit line limit**. Fixed widths are a layout bug. An address truncates as `0x1234…cdef`; a thesis clamps to 6 lines with an expand affordance.
- Wide data tables become a defined stacked-card list below the tablet breakpoint. They never become a horizontal scroller.

---

## 9. Component inventory

Every primitive below must exist before the first screen is built (`SKILL_FRONTEND_DESIGN.md` §3). Extending an existing primitive with an optional, defaulted prop is preferred over adding a new component; every genuinely new component must be justified in the phase record.

### 9.1 Layout and framing

| Component | Purpose |
|---|---|
| `PageShell` | Public and authenticated page frames, scroll ownership |
| `TopBar`, `Sidebar`, `BottomNav` | Navigation, each exporting its own height/width |
| `Section` | Vertical rhythm container (`--space-8/9` separation) |
| `Panel` | Bordered `--color-surface` container |
| `ChamferPanel` | Corner-bracket framed panel for the single key object |
| `Rule` | Horizontal hairline divider |
| `GridField` | Optional background column rules behind a hero |
| `Stack`, `Inline` | Spacing primitives bound to `--space-*` |

### 9.2 Signature devices

| Component | Purpose |
|---|---|
| `Eyebrow` | `// LABEL \\` monospace eyebrow |
| `SectionNumber` | `// 04 \\` opposite-edge section number |
| `SignalLine` | Horizontal ember rule with optional `reticle` node. Structural, once per major region |
| `Reticle` | Precision crosshair for coordinate pairs and verification marks |
| `CoordinatePair` | Labelled mono pair, e.g. `ENTRY / 113,400.00` |

### 9.3 Actions

| Component | Purpose |
|---|---|
| `Button` | Variants: `primary` (accent fill), `secondary` (outline), `ghost`, `destructive`. Sizes: `sm`, `md`, `lg` |
| `IconButton` | Icon-only, mandatory accessible name, 44px minimum target |
| `LinkButton` | Text link with an underline that appears on hover |
| `SegmentedControl` | Long/Short, entry-type, period selection |

### 9.4 Form controls

| Component | Purpose |
|---|---|
| `Field` | Label + control + helper + error, wired to `aria-describedby` |
| `TextInput`, `NumericInput` | Mono numerals, explicit input mode |
| `Textarea` | Thesis, clamped with a line limit |
| `Select` | Asset, entry type, leverage, expiry |
| `LeverageStepper` | Numeric with permitted bounds shown |
| `ExpiryControl` | Absolute timestamp with a relative hint |
| `Checkbox`, `Toggle` | Consent and preference |
| `ValidationMessage` | Text + `aria-live`, never colour alone |

### 9.5 Data display

| Component | Purpose |
|---|---|
| `StatBlock` | Eyebrow label, large mono figure, caption. `+` marker optional |
| `StatRow` | Label/value pair for dense plan and summary blocks |
| `DataTable` | Executions, activity. Header in `--type-label`, tabular figures |
| `PriceCell`, `PnlCell`, `DataCell` | Typed cells with sign glyph and fixed decimal treatment |
| `StatusChip` | Lifecycle state. Uppercase mono. Colour **and** text |
| `Tag` | Non-lifecycle metadata |
| `Timestamp` | Absolute mono UTC with relative hint |
| `Address` | Truncated mono with full value on copy/expand |
| `DirectionBadge` | `LONG` / `SHORT`, text-first |

### 9.6 Identity and reputation

| Component | Purpose |
|---|---|
| `Avatar` | Image with monogram fallback |
| `HandleBlock` | `@handle` in mono with verified-source markers |
| `ReputationBlock` | Ethos context: score, reviews, vouches, human verification, external link. Always visually separate from performance |
| `PerformanceBlock` | PASS performance metrics. Always visually separate from reputation |
| `ConnectionChip` | X / Hyperliquid / Ethos connection state |

### 9.7 State blocks

Every provider-dependent surface ships all of these. Each is a component, not an inline branch.

| Component | Purpose |
|---|---|
| `LoadingBlock` | Static sunken wells with an accent hairline. No shimmer loop |
| `EmptyBlock` | States what is absent and the one action that creates it |
| `ErrorBlock` | Plain statement of failure + `Retry` |
| `UnavailableBlock` | Provider unreachable, distinguished from a logic error |
| `StaleBlock` | Data is old; shows the age and the refresh action |
| `PermissionBlock` | Sign-in or connect-wallet required, with the specific reason |
| `RejectedBlock` | Execution rejected by provider, with the provider's reason |

### 9.8 Overlays

`Dialog` (focus-trapped, `aria-modal`), `BottomSheet`, `Popover`, `Tooltip`, `Toast`.

All use the overlay tier from §5.4. All trap or restore focus correctly. All close on `Escape`.

### 9.9 Chrome extension surfaces

| Component | Purpose |
|---|---|
| `ExtensionCard` | Injected PASS context card on an X profile or post |
| `ExtensionBadge` | Small presence marker on a matched profile/post |
| `ExtensionPopup` | Browser-action popup |

These are constrained: they carry a link and one line of context, then hand off. They do not trade, chart, or execute. They reuse `StatusChip`, `Button`, and the token layer, and nothing else.

### 9.10 Development surface

`Gallery` route rendering every primitive in every variant at every breakpoint, plus a narrow-width stress section with long values, wrapping rows, long labels, and extreme numbers. Gated out of production, and the gating must be **verified** both anonymously and signed in, not assumed.

---

## 10. Screen-by-screen direction

Screen inventory is derived from `docs/UX_SPEC.md` §3–§14 and the journeys in `docs/PRODUCT_PRD.md` §8. `docs/PRODUCT_PRD.md` §7 is the **core vocabulary** section, not a screen list; it is honoured through the terminology rules in §3.2 and §11 of this document, and through the copy discipline in §1.3.

For every screen below: **first / second / third** is the order the eye should land, and it is a testable requirement, not a suggestion.

### 10.1 Landing

**Purpose:** state the product's proposition and route to either exploring or creating. PRD §18.

1. **Hero line** — `See a trade. Know the trader. Take the trade.` at `--type-display-xl`, flush left, with a single `SignalLine` beneath it and one `reticle` node. The signal line reveals once on load (`--duration-deliberate`).
2. **Primary CTA** — `Explore Passes` as the single accent-filled button. `Create a Pass` is a ghost button immediately after it, never accented.
3. **The loop** — `X post → Pass → trader context → trade plan → Hyperliquid` as a five-step `CoordinatePair` strip under the CTAs. Statement, no illustration.
4. **Support line** — `PASS turns Hyperliquid trade plans into shareable, executable links.` as `--type-body-l` in `--color-text-secondary`, measure-capped.

Framing: full-bleed, `--color-canvas`, optional `GridField` behind the hero only. One `ChamferPanel` may frame the hero block. No product screenshot in the hero — the proposition is the product.

### 10.2 Discover / Explore Passes

**Purpose:** let a visitor find a Pass worth opening. PRD §4 goal 4.

1. **The Pass list** — the content. Rows, not cards, ordered by recency then relevance. Each row leads with asset + direction, then status chip.
2. **Filter controls** — a single row of `SegmentedControl` filters above the list: status, direction, asset. Always visible, never behind a menu.
3. **Result count** — a mono count in the eyebrow row, so the list is self-describing when short.

Row anatomy: `DirectionBadge` → asset (`--type-title-m`, Display) → status `StatusChip` → entry/TP/SL as a `CoordinatePair` → relative publish time. Trades performance metrics. A Discover row never shows PnL — the user has not taken anything, and PASS does not imply account performance proves Pass performance (PRD §13).

Empty state: `EmptyBlock` naming the absence and offering `Create a Pass`.

### 10.3 Pass detail — the core surface

**Purpose:** the conversion surface. UX_SPEC §5. One object, one decision.

**Above the fold on mobile, in this order** (UX_SPEC §11 requires asset + direction, trader, reputation, entry/TP/SL, status, and CTA to stay above the fold):

1. **Asset + direction** — `BTC LONG` at `--type-display-l`. The largest element on the page. `DirectionBadge` is text-first; long and short are not distinguished by colour alone.
2. **Status chip** — current lifecycle state, uppercase mono, directly under the asset line. Mandatory text.
3. **The plan block** — a `ChamferPanel` containing `ENTRY`, `TP`, `SL`, `LEVERAGE` as a `CoordinatePair` grid in `--type-data-m`, with a `reticle` at the panel's top-left. This is the second thing the eye finds because it is the thing the user came for.
4. **Trader block** — `@handle`, X link, Ethos reputation context, and PASS performance metrics in **two visually separate blocks**. They are never adjacent without a rule between them and never share a heading.
5. **Thesis** — `--type-body-l`, measure-capped, the first prose the user reads.
6. **Market context** — current mark/mid and the timestamp it was read. Marked `LIVE` or `STALE`.
7. **`TAKE PASS`** — the single accent-filled button, full-width on mobile, sticky to the bottom above the bottom nav on mobile only.

Explicitly absent: any charting by default, any "trust score", any urgency or social-proof counter, any auto-selected Taker size.

Desktop: the `ChamferPanel` holds asset/plan in columns 2–7, trader and market in 9–12, with the CTA beneath the plan block. One `SignalLine` separates the plan block from the market block.

### 10.4 Trader profile

**Purpose:** establish identity and credibility as **a verified credential, not a social bio**. PRD §11, UX_SPEC §6.

1. **Identity header** — avatar, `@handle`, one-line descriptor, and the connection chips (`X connected`, `Ethos`, `Hyperliquid`) as a single mono row. This reads as a credential block, not a profile card.
2. **Two separate blocks, trading first** — `PerformanceBlock` (published Passes, completed Passes, Pass success metric, observed account context where legitimately available), then a full-width `Rule`, then `ReputationBlock` (Ethos score, reviews, vouches, human verification, external link).
3. **Active Passes** — a compact list reusing the Discover row anatomy.

The rule between the two blocks is mandatory. Merging reputation and performance into one label, score, or card is prohibited by D-007 and PRD §12, and is a P0 anti-pattern.

### 10.5 Create Pass

**Purpose:** let a Trader author and publish a structured trade plan. UX_SPEC §7, PRD §8.2.

Single page, progressive, with a persistent preview.

1. **Preview** — the live `PassPreview`, a scaled-down render of §10.3 using the same primitives. It sits in a sticky aside on desktop and collapses to a toggle above the form on mobile. The Trader always sees the object they are making.
2. **The form** — one column, measure-capped at columns 1–7. Fields in the PRD §8.2 order: Asset, Direction, Entry type, Entry price, Stop loss, Take profit, Leverage, Thesis, Expiry.
3. **`Publish`** — the single accent-filled button, sticky at the form foot, **disabled with an inline reason** until the form is valid.

Validation is live and textual: price ordering, supported market, leverage bounds, expiry validity, TP/SL direction consistency. Each error sits under its field, is announced, and is never signalled by border colour alone. The Taker-size field does not appear here at all — a Trader publishes a plan, not a size instruction (D-015).

### 10.6 Take flow

**Purpose:** the execution funnel. UX_SPEC §8, PRD §8.3. This must feel like **a document being signed, not a checkout.**

Each step is a distinct route with its own title, so back/forward and refresh behave predictably. A progress indicator shows the step as mono text (`STEP 2 / 4`), not as a novelty stepper.

#### Step 1 — choose size

1. **The size field** — the first and largest element. Empty by default. A `Slider` is permitted as an *adjunct*; typing the exact number is always available and always authoritative.
2. **Pass context strip** — a compact restatement of asset, direction, and the Trader's entry/TP/SL, so the user is choosing a size against a visible plan.
3. **`Continue`** — accent-filled.

The Trader's position size, if shown at all, is labelled `TRADER'S PUBLISHED SIZE` in tertiary mono and is never the default value in the field.

#### Step 2 — execution preview

1. **The order summary** — a `ChamferPanel` styled as a document: Pass version, asset, direction, entry type, size, leverage, TP, SL, slippage tolerance, estimated margin.
2. **Warnings** — any validation failure from PRD §14, each as a plain sentence with a `alert-triangle`. Warnings are text, not red borders.
3. **`Authorize`** — accent-filled, bottom-right on desktop, full-width above the thumb on mobile.

Current market price and its timestamp appear in the summary, so the user is authorizing against a price they can see.

#### Step 3 — authorization

1. **Plain-language statement of what will happen** — `--type-body-l`, in full, above any control. It names the wallet, the market, the size, and that the Taker is authorizing their own order.
2. **The authorizing control** — the wallet/agent connect action. Accent-filled.
3. **Scope disclosure** — which permissions are being granted, in secondary body text.

No pre-ticked consent. No countdown. The copy explains; it does not persuade.

#### Step 4 — confirmation

1. **Provider order id and status** — mono, `--type-data-m`, in a `ChamferPanel` styled as a receipt. Includes the Hyperliquid status string verbatim.
2. **The resulting Pass lifecycle state** — `StatusChip`, so the user sees the Pass they took move state.
3. **Next actions** — `View Pass`, `View Executions`. Secondary, never accent; the accent retires once the action has succeeded.

Failure states here are first-class: `RejectedBlock` with the provider's reason, and a `Retry` that re-enters Step 2 rather than resubmitting blindly.

### 10.7 Stale Pass interstitial

UX_SPEC §9. Replaces the page when the reviewed parameters are no longer current.

1. **The statement** — `This Pass changed.` at `--type-display-m`, with the exact supplied copy beneath it.
2. **`Review latest Pass`** — accent-filled, and the only accent on the screen.
3. **What changed** — a mono diff of the changed parameters, when the API can supply it.

Execution is never silently attempted on stale parameters (UX_SPEC §9).

### 10.8 My Passes (dashboard)

**Purpose:** the Trader's own inventory. UX_SPEC §3.

1. **Lifecycle summary strip** — counts by state as `StatBlock`s across the top, mono, no colour coding of the counts themselves.
2. **The Pass table** — asset, direction, status, takers, published, expiry. Status chips carry state.
3. **`Create a Pass`** — accent-filled, in the section header.

Rows are `Pass` objects and link to §10.3. Draft and cancelled rows show a `ghost` treatment, never reduced opacity on text (which would break contrast).

### 10.9 Executions

**Purpose:** auditability. PRD §15, D-008.

1. **The executions table** — Pass, asset, size, entry fill, status, realized PnL, timestamp. `PnlCell` carries sign and colour together.
2. **Row detail** — expanding a row reveals the provider order id and the referenced Pass version, satisfying the reconstructability requirement in PRD §15.
3. **Period control** — a `SegmentedControl` above the table.

Per skill §9 rule 2, the period window uses exactly one date convention owned by one helper, half-open `[start, end)`, and is expressed as an **offset from now** rather than a frozen date, so the default window stays live.

Per skill §9 rule 1 and §10, if any figure here is also shown on the Pass page or a Trader profile, both surfaces must call **one** definition and read the same field, filters, and window.

### 10.10 Profile and connections (own)

1. **Connection states** — `ConnectionChip` per provider (X, Hyperliquid, Ethos), each with its own connect/reconnect action.
2. **Public profile fields** — display name, bio, avatar, and the Hyperliquid-identity exposure toggle.
3. **`Save`** — accent-filled.

Key handling rules from `AGENTS.md` are design constraints, not just engineering ones: no wallet secret is ever displayed, echoed, or stored in `localStorage`; the agent key is client-held; every execution requires explicit confirmation. A field that would display or request a seed phrase or master private key does not exist in this screen and must not be added.

### 10.11 Onboarding and connect

PRD §8.1. One step per screen.

1. **The step's single question** — one action per screen, headed by a display-size statement (`Connect your X identity.`).
2. **The action** — accent-filled, named for what it does (`Connect X`, `Generate agent wallet`, `Resolve Ethos`).
3. **Why it is needed** — one sentence in secondary body. Never a permissions essay.

Progress is mono text (`STEP 2 / 4`). Steps that cannot be completed because a provider is unavailable show `UnavailableBlock` and allow skipping where the PRD permits it.

### 10.12 Error and not-found

1. **A plain statement** — `This Pass does not exist.` / `Something failed.` at `--type-display-m`. No stack trace, no error code as headline.
2. **`Retry`** or **`Explore Passes`** — accent-filled, exactly one.
3. **Reference detail** — a mono request id, tertiary, for support. This is the only place an identifier appears.

### 10.13 Extension surfaces

Per D-009 and `docs/EXTENSION_SPEC.md`. **A discovery and context layer, not a second terminal.**

**Injected card on X:**
1. **One line of PASS context** — `2 active Passes` or `Pass active · BTC LONG`.
2. **`View Pass`** — the explicit handoff action (UX_SPEC §13).
3. **A `StatusChip`** when a matched Pass has a notable state.

No price, no PnL, no chart, no execution. The card is intentionally smaller than the X content it sits on.

**Extension popup:** the same content in a fixed 320px surface, with `Open PASS` as the single accent-filled action.

### 10.14 Social preview (Open Graph)

UX_SPEC §14. Not a screen, but it is a designed surface with its own rules.

```text
PASS
BTC LONG
@TraderX
Entry $113.4K • TP $116K • SL $111.9K
```

Background `--color-canvas` with `--color-text-primary` and at most one `--color-accent-text` element. No image asset is required for v1. Compact figure formatting is used **here and in headline contexts only** — never in the execution review. No private account data appears (UX_SPEC §14).

### 10.15 Gallery (development route)

Every primitive × every variant × every breakpoint, plus the narrow-width stress section. Gated out of production, gating verified both anonymously and signed in. A defect found here is cheaper to fix than a defect found in a device pass.

---

## 11. Data-display rules

These rules are what make PASS read as an instrument rather than a feed. They are not stylistic preferences.

### 11.1 The data face rule

**Every** price, size, PnL, entry, TP, SL, leverage, timestamp, address, hash, Pass id, and status chip is set in IBM Plex Mono with `font-variant-numeric: tabular-nums`. No numeric value is ever set in Archivo or Inter Tight.

This includes values inside prose. A thesis that mentions `$113,400` sets that figure in the data face at the surrounding size, inline.

### 11.2 Prices

- **Decimals are never chosen client-side.** Precision follows the market's convention as supplied by the Hyperliquid info API. The client formats what it is given and does not re-round.
- Displayed with a thousands separator and the market's decimal count.
- Always accompanied by its unit or market where ambiguity exists (`BTC-PERP`, `113,400.00 USDC`).
- A price always has a source and a time: either the Pass's published entry, or the live mark with a `LIVE`/`STALE` chip and timestamp.

### 11.3 Entry, TP, SL, leverage

Presented as a **`CoordinatePair` grid**, not as a sentence and not as a definition list with proportional figures. This is PASS's precision motif: a labelled value with a `reticle` marker, monospaced, decimal-aligned.

The three price levels are visually equal in weight. They are **not** colour-coded good/bad — a long trade's TP being higher is not "good". If a level has been reached, that is shown by the Pass **status chip**, not by tinting the number.

Leverage is always shown next to size, never on its own, because leverage without size is meaningless.

### 11.4 PnL and deltas

- **Sign glyph is mandatory** (`+` / `−`, U+2212 minus, not a hyphen). Directional arrows are added where the value is a change rather than a quantity.
- Colour is secondary reinforcement only: `--color-data-positive` / `--color-data-negative`.
- The accent is **never** used for PnL.
- Currency is always explicit in the label or a unit suffix. A bare number with a coloured arrow is forbidden.
- Realized and unrealized PnL are visually and structurally distinct, and never summed into one headline figure.
- PASS performance and Hyperliquid account performance use separate blocks, separate headings, and separate labels (PRD §13, D-014). If a screen would place them adjacent without a rule between them, it is wrong.

### 11.5 Timestamps

- Absolute form, mono, UTC, with the zone stated: `2026-10-03 14:22 UTC`.
- Relative form is **secondary** and tertiary-coloured: `2h ago`. It never replaces the absolute form.
- Expiry shows both: absolute expiry plus a relative hint.
- **One date convention across the whole product**, owned by one helper, with an explicit timezone basis, and half-open `[start, end)` windows so a boundary instant cannot land in two periods (skill §9, rule 2). Period selections are stored as offsets from now, never as frozen dates.
- The renderer's local timezone never silently shifts a displayed value. If the user's zone would change the displayed date, show both and label them.

### 11.6 Identifiers

- Addresses truncate as `0x1234…cdef` (4 leading, 4 trailing). Full value available on copy and on expand.
- Pass ids are mono and never truncated in the execution review.
- A truncated identifier always exposes its full value to assistive technology via the accessible name.

### 11.7 Pass status

- Always uppercase, always monospace, always text. `StatusChip`.
- Colour is a secondary cue only, and the mapping is:

| State | Chip treatment |
|---|---|
| `DRAFT` | Tertiary text, hairline border |
| `ACTIVE` | `--color-text-primary`, hairline border |
| `ENTRY_PENDING` | `--color-accent-text`, accent hairline border |
| `OPEN` | `--color-text-primary`, hairline border |
| `TP_HIT` | `--color-data-positive`, hairline border |
| `SL_HIT` | `--color-data-negative`, hairline border |
| `EXPIRED` | `--color-text-tertiary`, hairline border |
| `CANCELLED` | `--color-text-tertiary`, hairline border |
| `INVALIDATED` | `--color-text-tertiary`, hairline border |
| `MANUALLY_CLOSED` | `--color-text-secondary`, hairline border |

Note that no chip uses a filled accent background. The accent is rationed (§2.5), and the status chip is text-first by design. UX_SPEC §2 also requires that the displayed state remain unambiguous, which the text guarantees and colour cannot.

### 11.8 Metrics shown on a Pass

Only **PASS-owned, verified** metrics (UX_SPEC §5G). A Pass page may show how many Takers took it and PASS's own recorded outcome for that Pass. It may not show the Trader's account-level PnL as though it were the Pass's performance.

Every metric carries its denominator or window. `12 taken` and `12 taken this week` are different claims and are worded differently.

---

## 12. Anti-patterns

A screen is checked against this list, and against the process anti-pattern list in `design/FRONTEND_IMPLEMENTATION_PLAN.md`, before it can be called done.

### 12.1 Structural anti-patterns — forbidden

- **Drop-shadowed floating cards.** No shadow-based elevation on any non-overlay surface (§5.4).
- **Gradient-as-decoration.** No gradient fill on a surface, a border, or a heading. The only permitted gradients are `--shadow-overlay`'s scrim and the `reticle` glow, which is a structural device.
- **Glassmorphism.** No backdrop blur, no translucent panels, no frosted surfaces.
- **Neon on neon.** No second saturated hue. No glow behind text.
- **Animated backgrounds.** Nothing animates behind reading content. No drifting particles, no moving gradients, no looping scanline over text. The `SignalLine` reveals once and then is still.
- **Drop shadows on text.** No text shadow anywhere.
- **Row striping.** Dense tables use hairlines, not zebra fill.
- **Radii above 4px** anywhere (§5.1).
- **A UI framework.** No component library, no design system package. Every shipped screen is a composition of this document's own primitives. Introducing a framework requires an explicit amendment to this document.

### 12.2 Content anti-patterns — forbidden imagery and iconography

- **Emoji**, anywhere.
- **Generic crypto iconography** — no coins, tokens, rocket, robot mascots, rockets, charts-as-clipart, candlestick illustrations.
- **Stock photography of people.** No human faces in product surfaces.
- **No product screenshot in the landing hero.**
- **No custom logo mark** until gap G-2 is closed.
- **No decorative illustration.** Where the reference direction uses a satellite scan, PASS uses a signal line and a reticle, both structural.

### 12.3 Synthetic-trust anti-patterns — forbidden outright

These are product violations, not style issues, and they are P0:

- **No "trust score"**, or any single synthetic label combining reputation and performance (D-007, PRD §12).
- **No implication that account-level performance proves Pass-level performance** (PRD §13).
- **No risk rating, safety score, or "verified trader" badge** synthesised by PASS. Verification markers are shown only as the named source's own state — `X connected`, Ethos human-verification state — attributed to that source.
- **No leaderboard framed as a skill ranking.** Aggregate public metrics are permitted; ranking people is not.

### 12.4 Copy anti-patterns — forbidden shapes

- **Casino and hype language.** No `WIN`, `JACKPOT`, `LIT`, `PUMP`, `LOCKED IN`, `MOON`, `ALPHA`.
- **Guarantees.** No `guaranteed`, `risk-free`, `safe`, `cannot lose`, `assured`. PRD §5 excludes financial advice and guarantees.
- **Urgency and scarcity.** No countdowns, no `X people are taking this now`, no `closing soon`.
- **Celebration of data.** No `🎉`, no `You made it!`, no congratulation on a profitable position.
- **Calling a Pass a "signal"** in primary UI (UX_SPEC §2).
- **Friction language on the execution path.** No `Are you sure?` as a modal. No `you must accept` beyond the actual consent being requested.
- **Sentence-shaped feature descriptions.** No `In order to take a Pass, you first need to...`.
- **Exclamation marks.**
- **Sentence-case buttons that hide the action.** Buttons name the action: `Take Pass`, `Publish`, `Authorize`. Not `Continue` where a better verb exists, and never `Submit`.

### 12.5 Colour-use anti-patterns — forbidden

- The accent filling anything other than the single primary action, an active nav item, a focus ring, or the signal line.
- The accent as a data-direction colour.
- The price-data pair on any non-data surface — no green buttons, no red banners, no coloured panel headers.
- Colour as the sole carrier of status, direction, validity, or verification (§2.8).
- More than roughly 5% of a viewport's pixels in a saturated hue.
- A dark surface that does not extend to the viewport edge. A light gap below a dark page is a P0 visual defect at every breakpoint.

---

## 13. What this document deliberately does not specify

Per `SKILL_FRONTEND_DESIGN.md` §4, when a screen needs a visual decision this document does not cover, **stop and record the gap**. Do not invent visual language to fill it. Each item below is an open question, not permission to improvise.

### 13.1 Recorded design gaps

| ID | Gap | Why it is open | Must not be improvised |
|---|---|---|---|
| G-1 | Light-mode token values | Dark-only is decided (§2.7); values are not designed | Do not invert or auto-derive a light palette |
| G-2 | PASS wordmark / logo mark treatment | No mark has been designed or cleared | Do not draw a logo, reuse the reference's, or improvise a favicon |
| G-3 | Chart and PnL-curve visualisation styling | Advanced charting is a PRD §5 non-goal. A minimal sparkline is specified in §10.2/§10.3 as context only | Do not add candlesticks, indicators, drawing tools, or a chart terminal |
| G-4 | Whether `ReputationBlock` collapses on mobile, and to what | Depends on real mobile density, which Stage K will measure | Do not hide reputation behind a toggle without a decision |
| G-5 | Empty-state illustration language | §12.2 forbids decorative illustration; a typographic empty state is specified but a second form is not | Do not introduce illustration |
| G-6 | Avatar fallback art direction beyond the monogram | Not designed | Do not use generated or stock avatar art |
| G-7 | Behaviour at large OS font-scale settings | Marked *not yet earned* in `SKILL_FRONTEND_DESIGN.md` §12 and never tested on this project | Do not assume reflow is safe; record the finding |
| G-8 | Modal vs bottom sheet for authorization on tablet | Depends on measured one-handed reach at that breakpoint | Do not pick per-screen |
| G-9 | Print stylesheet | Out of scope; no requirement in the PRD | Do not add |
| G-10 | Notification / alert surfaces | Not in the MVP scope | Do not add |
| G-11 | Exact icon set and its licence | Glyph names are specified (§7.2); the source is not chosen | Do not mix icon sets or draw approximations inconsistently |
| G-12 | Localisation and number/date locale formatting beyond UTC | MVP is English + UTC (§11.5) | Do not add locale switching |
| G-13 | The `SignalLine` sweep beyond the hero | Deliberately limited (§6.4) | Do not animate signal lines on inner panels |
| G-14 | Token layer file path | Owned by the one-shot build's workspace layout, which does not exist yet. `design/FRONTEND_IMPLEMENTATION_PLAN.md` names it provisionally | Do not create a second token source |
| G-15 | Input border contrast | **Closed 2026-10-06.** `--color-line-strong` measured 1.37:1 on `--color-surface`, failing the 3:1 UI-boundary minimum. §5.3 and §2.3 amended to `#656577` (3.33:1). Derivation in §5.3.1. | Resolved — the value was amended in this document, not patched in code |

### 13.2 When a gap is hit

1. Stop. Do not pick a visual.
2. Record it in the phase record's design-gap log with: the screen, what was needed, what was missing, and what was deliberately **not** done.
3. If the gap is a real hole in this document, amending this document is a legitimate, separately recorded deliverable of that phase — with a stated reason. It is not a side effect of coding.
4. If this document does in fact cover it, the implementation is wrong. Fix the implementation.
5. Never edit this document to match a buggy implementation.