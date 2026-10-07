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

### 2.9 Errata (measured)

Five contrast figures quoted in §2.4, §2.5, and §2.6 do not match computation.
This subsection records the discrepancy and **does not change the original
stated values**, so both what was specified and what was measured survive.

Measured 2026-10-06 with the WCAG 2.1 relative-luminance formula, by
`scripts/check-contrast.mjs`, which runs on every `pnpm run check`.

| Token | §2 states | Measured | Delta | Verdict affected? |
|---|---|---|---|---|
| `--color-text-secondary` on `--color-canvas` | 8.9:1 | **8.99:1** | +0.09 | No — passes 4.5:1 either way |
| `--color-text-disabled` on `--color-canvas` | 2.6:1 | **2.80:1** | +0.20 | No — already a reported residual, scoped to disabled controls by §2.4 |
| `--color-text-on-accent` on `--color-accent` | 5.6:1 | **5.02:1** | −0.58 | No — passes 4.5:1, but the largest discrepancy here |
| `--color-accent-text` on `--color-canvas` | 5.9:1 | **6.22:1** | +0.32 | No — passes 4.5:1 |
| `--color-data-positive` on `--color-canvas` | 8.7:1 | **8.65:1** | −0.05 | No — passes 4.5:1 |

**No entry changes a pass/fail verdict, so none is escalated to a design gap.**
Confirmed individually above. The largest single discrepancy is
`--color-text-on-accent`, which the document overstates by 0.58; it is the one
to re-check first if the value is ever moved, because it has the least headroom
of the passing text pairings at 5.02:1 against a 4.5:1 minimum.

Figures not listed above were computed and matched their stated value:
`--color-text-primary` 17.59:1 against a stated 17.6:1,
`--color-text-tertiary` 5.40:1 against 5.4:1, `--color-data-negative` 5.32:1
against 5.3:1.

Two measured figures are recorded outside the §2 tables and are not errata,
because §2 never stated them: `--color-line-strong` on `--color-surface`, now
**3.33:1** after the G-15 amendment (§5.3.1), and `--color-line-hairline` on
`--color-surface` at 1.16:1, which is decorative and therefore exempt from the
non-text minimum.

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
| G-2 | PASS wordmark / logo mark treatment | **Closed 2026-10-07** by §14.14, which designs the mark from PASS's own §9.2 signature devices. The reference's mark must still not be copied. | Resolved — the mark is specified here, not improvised in code |
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

---

## 14. Visual language extracted from the reference set

**Added 2026-10-07. Reason.** The operator opened the thirteen Stage K screens
against `design/references/` and reported them "too generic", "dull", and
"not alive", with "missed details and cards from the reference". The cause was
not compliance failure: §§1–13 specify palette, type scale, spacing, motion and
principles, and the build satisfies all of them. The cause is that **§§1–13 never
described the actual visual language of the reference set** — no gradient, no
grain, no corner brackets on cards, no numbered eyebrows, no oversized display
type with ember accent words, no dense data cards, no live indicators, no status
badges with icons, no ticker. A document that does not describe a thing cannot be
complied with, and "generic dark theme" is what you get when the specification
is silent.

This section is that specification. Every value below was read off the reference
images and is stated as a mechanic with concrete numbers, not as mood. Where an
earlier section conflicts, **this section wins for the surface it names**, and
the conflict is called out inline.

**Discipline (`SKILL_FRONTEND_DESIGN.md` §4).** The references are *feel and
direction, never literal layout*. PASS does not reproduce TONNE's carbon market,
its orbital imagery, its planet renders, or its page composition. What is
extracted is the **machinery** — how a background is built, how a card is
anatomied, how type is scaled and coloured. Imagery is out of reach and out of
scope: PASS has no asset pipeline, and §12.2 forbids substituting decoration for
the data.

### 14.0 Typeface substitution (logged decision)

The reference uses **Clash Display** (heading), **Space Grotesk** (body) and
**JetBrains Mono** (all data). PASS ships **Archivo** (display), **Inter Tight**
(body) and **IBM Plex Mono** (data), committed to
`apps/web/public/fonts/` and proven byte-identical to upstream by
`scripts/check-fonts.mjs`.

The substitution is deliberate and is **not** an open gap. The gap that produced
the operator's complaint is size, weight, tracking and colour treatment — not
typeface identity. Archivo at weight 700 with negative tracking at 90px occupies
the same optical role as Clash Display; IBM Plex Mono at tabular figures carries
every numeric surface in the reference unchanged. Swapping three verified,
committed, provenance-checked faces would add risk and no mechanic the current
stack cannot express. §3.1 stands unamended.

---

### 14.1 Backgrounds

The reference is **never flat black**. This is the single largest reason the
Stage K screens read as generic: `--color-canvas: #0a0a0a` is a flat fill, and
every screen inherited it.

**Gradient wash.** A broad radial, ember at the core, falling through rust to
black at the edges. Three observed strengths:

| Treatment | Core | Mid | Falloff | Used on |
|---|---|---|---|---|
| `wash-hero` | `#F4552E` at 38% | `#7A2410` at 22% | `#0A0A0A` at 0% | Landing hero, trader profile header |
| `wash-section` | `#B0300F` at 22% | `#4A1408` at 14% | `#0A0A0A` at 0% | Pass detail hero, Discover header |
| `wash-tight` | `#FF6B33` at 55% | `#8A2A12` at 30% | `#0A0A0A` at 0% | Wordmark / device mockup hero only |

Geometry: `radial-gradient(ellipse 90% 70% at 50% 38%, …)`. The ellipse is wider
than tall and sits **above** centre, so the brightest point is behind the
headline's first line and decays down the page. `--color-canvas-gradient-core`,
`--color-canvas-gradient-mid` and `--color-canvas-gradient-edge` are the three
stops; the alpha ramp above is expressed as `--wash-core-alpha`,
`--wash-mid-alpha`.

**Flat rule.** Data-heavy surfaces get **no gradient**: Executions, My Passes,
the Take flow preview and Settings are flat `--color-canvas` with grain only.
A gradient behind a dense table reduces the contrast of the digits it sits
under, which is the one thing §11.1 refuses to compromise. This matches
reference image 5, which is the only data screen and the only one without a wash.

**Grain.** A fine monochrome noise layer over everything, at **4% opacity**,
`mix-blend-mode: overlay`, `pointer-events: none`, `aria-hidden`. Implemented as
a base64 SVG `feTurbulence` tile (no binary asset, no network request), sized
128×128 and repeated. At 4% it must be invisible on a photograph of the screen
and visible only as the absence of banding in the gradient. `--noise-opacity: 0.04`.

**Ghost watermark.** Oversized brand type at **5% opacity**, bleeding off both
edges, behind hero content only (reference images 8, 9). Never behind body copy,
never on a data surface.

### 14.2 Corner brackets

The reference frames its key objects with four thin L-shaped corner brackets
(reference images 3, 9, 11) — a device, not a border.

- Leg length `--bracket-length: 28px` (16px below the tablet breakpoint).
- Stroke 1px (`--stroke-bracket`), colour `--bracket-color: #3A3A46`, which is
  `--color-line-strong` at 60% — visible as a frame, never as a box.
- Inset from the element edge by `--bracket-offset: 8px`, so the brackets sit
  *inside* the padding, not on the boundary.
- Four corners. All four are drawn; the bottom pair is the more visible of the
  two because the top pair sits against a brighter gradient.

**Used on exactly four things, and no more** (§2.5 rations the accent for the
same reason):

1. Landing hero frame.
2. Pass detail top card.
3. Trader profile header.
4. The Landing "How it works" 2×2 grid as a group, one frame around the set.

Where a key panel already carries the §5.2 chamfer, the brackets are drawn
*around* the chamfer and do not replace it.

### 14.3 Numbered eyebrows

Every section opens with a numbered eyebrow (reference images 2, 3, 6, 11, 13).
This is the reference's most consistent device and it is absent from the whole
Stage K build.

**Exact format**, left and right of the section, on one line:

```
\\  SECTION NAME  \\                    \\  07  \\
```

- Monospace, uppercase, `11px` (`--type-eyebrow-size`), tracking `0.18em`
  (already `--type-eyebrow-track`).
- The `\\` delimiters and the two-digit number are `--color-accent`.
- The label is `--color-text-tertiary`.
- Left-aligned to the content edge; the number hard-right to the content edge.
- Never centred, never omitted on desktop, never bold.
- Colour is the only accent on the line, so it must survive greyscale (§9.4) —
  which it does, because the word is written out and the number is a number.

Per-screen numbering is fixed and sequential; restarting a screen's numbering
breaks the reader's sense of position:

| Screen | Sections and numbers |
|---|---|
| Landing | `01 THE LOOP`, `02 HOW IT WORKS`, `03 THE NETWORK` |
| Discover | `01 LIVE PASSES`, `02 TRADERS`, `03 ARCHIVED` |
| Pass detail | `01 THE PLAN`, `02 PERFORMANCE`, `03 THE TRADER` |
| Trader profile | `01 REPUTATION`, `02 PERFORMANCE`, `03 ACTIVE PASSES` |
| Take flow | `01 SIZE`, `02 CONSENT`, `03 REVIEW`, `04 CONFIRM` |
| How it works | `01 AUTHOR`, `02 PUBLISH`, `03 TAKE`, `04 SETTLE` |
| My Passes / Executions / Profile | `01`–`03`, matching their sections |

A **dot** variant replaces the number where the section is live rather than
positioned: `● MARKET SNAPSHOT`. Ember dot, 6px, then the label. Used only on
data surfaces whose content changes (§14.7).

### 14.4 Display headlines

**This is the second-largest gap.** The Stage K hero renders at
`clamp(2.5rem, …, 4.5rem)` in a normal weight. The reference headlines are
roughly **twice** that, at display weight, tracking negative, split across two or
three deliberate lines, with **one ember word per line**.

**Mechanic.** A headline is an explicit list of lines. Each line is a list of
words. Exactly **one word per line** carries `--color-accent`; every other word
is `--color-text-primary`. The ember word is the claim, not decoration, so it is
the word a reader would keep if they remembered one.

**Sizes** (`--type-display-hero-size`, one `clamp` token):

| Breakpoint | Hero | Section headline | Tracking | Weight |
|---|---|---|---|---|
| 375 | 34px / 1.04 | 26px / 1.1 | −0.02em | 700 |
| 768 | 48px / 1.02 | 34px / 1.08 | −0.025em | 700 |
| 1280 | 72px / 1.0 | 48px / 1.05 | −0.03em | 700 |
| 1440 | 92px / 0.98 | 56px / 1.05 | −0.03em | 700 |

Never larger than 92px. Never below 34px — a hero that wraps to five lines at
375px is a layout failure, so line breaks are authored, not left to the browser.

**Exact copy and accent word per screen:**

| Screen | Lines | Ember word |
|---|---|---|
| Landing | `See a **trade**.` / `Know the trader.` / `Take the trade.` | `trade` (line 1) |
| Discover | `Live **plans**,` / `written by traders.` | `plans` (line 1) |
| Pass detail | `BTC **LONG**` | `LONG` |
| Trader profile | `@handle is` / `**verified** on PASS.` | `verified` (line 2) |
| Take flow | `You author` / `your own **size**.` | `size` (line 2) |
| How it works | `A **Pass** is` / `a plan, not a promise.` | `Pass` (line 1) |

Where a headline carries a live value (`BTC LONG`, `@handle`), the value is
`--type-data-*` **not** the display face — §3.2 forbids setting data in a body
face and the same rule binds in reverse.

**Gradient variant.** The reference also runs a horizontal
`linear-gradient(90deg, primary, accent, primary)` across a headline
(reference image 6). Permitted **only** on the Landing hero, never on a section
headline, and never on a headline containing a live value — a gradient behind
changing digits makes the digits harder to read.

### 14.5 Data cards

**The defining pattern of the reference, and the one the operator named
("missed details and cards from the reference").** Anatomy, top to bottom,
exactly as reference images 7, 10 and 12:

1. **Container.** `--card-bg: #0B0B0E`, border `1px solid --card-border`
   (`#23232C`), radius `--card-radius: 12px`. A **1px lighter top edge**
   (`#33333F`) at 60% — a light source above the card. Bottom corners carry a
   `--chamfer-size` cut (§5.2); top corners are square. This asymmetry is the
   reference's, not a rounding error.
2. **Header row.** Left: identifier in `--color-accent`, mono, uppercase, 12px,
   tracking `0.08em` — `BTC LONG`, `PASS 7721`. Right: optional `● LIVE`
   (§14.7) or a state word. Hairline separator below.
3. **Sub-line.** One muted line under the identifier: the asset name, the
   direction, or the project subtitle. Off-white at 60%.
4. **Primary value.** `--type-data-xl-size` (40px at 1280+), mono, tabular,
   `--color-text-primary`, with a **unit suffix** at `--type-data-s-size` in
   `--color-text-tertiary` set on the same baseline — `$113.4K` / `per ETH`.
   Never separated onto its own line.
5. **Hairline separator.**
6. **Metric rows.** `LABEL` left, `VALUE` right, one per line, separated by
   hairlines. Label: mono, uppercase, 11px, `0.08em`, tertiary. Value: mono,
   tabular, `--type-data-m-size`, primary. Row height 28px. This is a
   definition list; the value is never centred.
7. **Sparkline** (optional). Full-bleed inside the card, 64px tall, 1px line in
   `--color-data-positive` or `--color-data-negative` with a 24% gradient fill
   beneath, in a `--color-surface-sunken` inset box with a hairline border. No
   axes, no labels, no gridlines. §11.2 governs what a price may show; this is
   the only chart PASS has, and G-3 forbids more.
8. **Status row** (optional). Label left, status word + 14px icon right, in the
   status tone (§14.6).
9. **Action** (optional). Full-width, `--card-pad` inset, ember-filled with
   `--color-text-on-accent`, 6px radius, label left and a `↗` at the right.
   Outlined in the state tone when the action is not the card's primary act.

Padding `--card-pad: 20px` (16px at 375). **Hover**: border brightens from
`--card-border` to `--color-accent-edge`, 180ms, and the top edge brightens with
it. No lift, no scale, no shadow (§5.4 forbids shadow on a non-overlay surface).

**Card types required by PASS:**

| Type | Where | Contents |
|---|---|---|
| Pass card | Discover grid, trader profile Active Passes | Identifier `BTC LONG`, sub-line direction, entry value + `per ETH`, sparkline 24h, rows: Take profit / Stop loss / R:R / Takers / Expiry, status row, `Open Pass ↗` |
| Trader card | Discover grid | Avatar (§14 identity), `@handle`, display name, Ethos score as the primary value, rows: Active Passes / Completed / Vouches, `View profile ↗` |
| Market snapshot | Pass detail, Discover header | `● MARKET SNAPSHOT` + `● LIVE`, price as primary value, sparkline, rows: 24h change / 24h volume / Funding, `View on Hyperliquid ↗` |
| Metric card | Pass detail metric row | Single label + single value. Five across at 1440, three at 1280, two at 768, one at 375. Values are `ENTRY`, `TAKE PROFIT`, `STOP LOSS`, `LEVERAGE`, `R:R` — §11.3's set, no additions |
| Stat card | Trader profile, My Passes | Label, value, sub-line. Counts are mono and **never** colour-coded (§10.8.1) |
| Order preview | Take flow steps 3–4 | Side, size, entry, TP, SL, estimated fee, `You authorize this exact order` as the sub-line |

### 14.6 Status badges

An icon plus a word, never a word alone and never colour alone (reference images
3, 7, 10, 12).

- Mono, uppercase, `10px`, tracking `0.1em`.
- 14px line icon at the left, 6px gap, 1.5px stroke, currentColor.
- Padding `4px 8px`, radius 4px, background = the tone at 12%, border = the tone
  at 35%.
- On a card's status row the badge is **borderless** and the word alone is
  coloured; the pill form is for standalone badges in a filter bar or a rail.

| PASS state | Icon | Tone | Token |
|---|---|---|---|
| `draft` | pencil | muted grey | `--badge-draft` |
| `active` | filled ember dot | ember | `--badge-active` |
| `entry_pending` | clock | ember | `--badge-entry-pending` |
| `open` | pulse dot | ember | `--badge-open` |
| `tp_hit` | arrow up-right | positive | `--badge-tp-hit` |
| `sl_hit` | arrow down-right | negative | `--badge-sl-hit` |
| `cancelled` | circle-slash | neutral | `--badge-cancelled` |
| `expired` | hourglass | neutral | `--badge-expired` |
| `invalidated` | exclamation in circle | negative | `--badge-invalidated` |

The **word is the state**. `data-tone` and the icon reinforce it (§9.4), and the
full set reads correctly in greyscale.

### 14.7 Live indicators

- Dot: `--live-dot-size: 6px`, `--color-accent`.
- Pulse: `--live-pulse-duration: 2000ms`, opacity `1 → 0.35 → 1`, `--ease-standard`,
  **two iterations then rest** — it establishes liveness and then stops, because
  a permanently looping dot is a distraction the reference never has.
- Reduced motion: `--duration-instant` (no pulse), dot at full opacity, `LIVE`
  word retained. The information is the word, never the animation (§6.6).
- Label form is `● LIVE` for a market snapshot and `● 4 ACTIVE` for a count.

Used on: the market snapshot header, the Discover ticker, the trader's active
Pass count, and the Take flow's price while it is being fetched.

### 14.8 Ticker / data bar

A thin full-bleed bar directly under the topbar on Discover and Pass detail
(reference image 5). Height 28px, `--color-surface-sunken`, hairline bottom
border.

Content: 4–6 entries, each `SYMBOL  PRICE  ▲2.41%` in one mono run at
`--type-data-xs-size`, symbol tertiary, price primary, delta in the data tone.
Entries separated by `--space-4`; **no scrolling animation** — it re-renders on
each poll, which is honest and costs nothing (a marquee that never matches the
data is a lie the reference does not tell).

A bar that cannot be populated (no market data, or fetch failure) renders as a
single muted row reading `MARKET DATA UNAVAILABLE` and nothing else. It never
renders empty.

### 14.9 Chip buttons

**Chamfered, not rounded.** The reference chips (image 6) have 45° cut corners,
consistent with §5.1 and §5.2. This section overrides any reading of the chips
as rounded.

- `clip-path` chamfer of `--chamfer-size` on all four corners.
- Background `--color-surface-raised`, border `1px solid --color-line-strong`,
  text `--color-text-primary`.
- Label mono uppercase, 12px, tracking `0.08em`.
- Padding `10px 16px`, minimum hit area `--size-target-min`.
- Hover: border → `--color-accent`, text → `--color-accent-text`, 180ms.
- `aria-pressed="true"`: background `--color-accent`, text
  `--color-text-on-accent`, border `--color-accent`. This is the reference's
  selected timeframe chip (image 5) and it is an accent fill — so **one** accent
  fill per region (§2.5), which is why a filter bar of chips shows one selected.

Used for: Discover filters, Take-flow step navigation, the Executions period
control, and the informational pages' category chips.

### 14.10 Numbered step grid

The 2×2 grid (reference image 4). Structure per card:

1. **Number badge** — a 28px circle, 1px `--color-accent` border, transparent
   fill, the step digit centred in mono 13px `--color-accent`. Not filled: a
   filled circle would spend the accent twice per section.
2. **Title** — 15px, weight 600, `--color-text-primary`.
3. **Description** — 13px, `--color-text-secondary`, max `--measure-body`.
4. **Visual slot** — full-bleed inside the card, `--radius-md`, hairline
   border. PASS fills this with a **data card or a stat row**, never an image:
   §12.2 forbids illustrative imagery and PASS has no asset pipeline.
5. **Footer row** — label left, 14px ember icon right.

Grid: 2 columns at 768 and above, 1 column at 375. Gap `--space-5`. Cards are
equal height (`align-items: stretch`); their footers align on a shared baseline
via a grid row, never by padding hacks.

Used on: Landing "How it works" (four steps, shortened copy) and the full
`/how-it-works` page (four steps, full copy).

### 14.11 Terminal-grade density

For any surface showing rows of figures — Executions, My Passes, the order book
on Pass detail (reference image 5):

- Row height `--row-height-dense: 34px`, vertically centred.
- All figures mono, tabular, right-aligned; labels left-aligned mono uppercase
  11px tertiary.
- Separator `1px solid --color-line-hairline`. **No zebra striping** (reference
  uses none; §12.1 already forbids it).
- Column headers: mono uppercase 10px, `0.1em`, tertiary, sticky within a
  scrolling region.
- A selected row carries a 2px `--color-accent` **left** border and
  `--color-surface-raised`; it is never a filled row.
- **No horizontal scroller, at any width** (§8.5). Below 720px the rows become
  stacked cards (§14.5 Pass card anatomy, collapsed to label/value pairs).
- The density must not cost legibility: 34px is a floor for a *row*, not a
  target for a touch target. Any row containing an interactive control keeps
  `--size-target-min` on the control itself.

### 14.12 Iconography

Thin line icons, `1.5px` stroke (`--stroke-icon`, already a token), 14px default
optical size inside a 20px grid, round caps and joins, `currentColor`, no fills
except the `●` live dot and the badge glyphs in §14.6.

Every icon sits in a 20px box so an icon and a mono glyph align on the same
optical baseline. No icon is ever the only carrier of meaning (§9.4).

### 14.13 What "alive" means

The operator's word, translated into exactly six permitted behaviours. This is a
closed list; a seventh is a gap, not an improvisation.

1. **Backgrounds are never flat.** Gradient wash + grain (§14.1). This is the
   single largest contributor and it costs no motion.
2. **Live dots pulse twice, then rest** (§14.7).
3. **Figures count up once on first render.** `--duration-deliberate` (420ms),
   `--ease-standard`, integer-quantised, from a value already on screen so it
   never shows `0`. Reduced motion: instant.
4. **Cards brighten their border and top edge on hover** (§14.5). No lift, no
   scale.
5. **Sparklines draw their line on first render** — a 420ms
   `stroke-dashoffset` sweep left to right, then nothing. Reduced motion: the
   line is simply present.
6. **Status changes cross-fade over 180ms** — the outgoing word fades out and
   the incoming word fades in on the same baseline. No slide, no flip, no count.

**Forbidden, explicitly:** looping animation of any kind, bounce, overshoot,
elastic easing, parallax, auto-playing video, animated background gradients, and
any motion on anything the operator did not cause. `--ease-linear` is for the
live dot only. §6.4's inventory is unchanged; this section adds entrances, not a
motion system.

### 14.14 Identity — the PASS mark (closes G-2)

**G-2 is closed by this section.** A mark is now designed, so §12.2's prohibition
on improvising a logo and §7.3's "no custom logo until G-2 closes" no longer
bind. G-2's other half — *reuse the reference's mark* — remains forbidden: the
mark below is derived from PASS's own §9.2 signature devices, not from the
reference's orbit ring.

**The mark.** `PASS` set in Archivo 700, all caps, `--color-text-primary`, with
two ember elements:

1. A **signal line** — `--stroke-icon` ember, horizontal, at the wordmark's
   optical mid-height, running the full width of the word and extending `6px`
   past the final `S` on each side. This is §9.2's `SignalLine`, the product's
   own signature device.
2. A **reticle in the P's counter** — a `1px` ember ring sized to sit inside the
   counter with `2px` clearance, crossed by the signal line, with a filled
   `3px` ember dot on the ring's upper-right at 45°.

**Why the P.** The reference puts its ring-and-dot in a letter with a **round
counter** — its `O`. Of PASS's four letters, only the `P` has one. The `A`'s
counter is triangular and a circle does not sit in it; the `S` has no counter at
all and a reticle collides with both terminals. The `P` is therefore the only
letter that can carry a ring, and it is the direct structural analogue of the
device being borrowed.

**Why a reticle and not an orbit.** A ring-plus-dot is generic; a ring-plus-dot
that is *also* PASS's own reticle and *also* sits on the signal line is the
product's language. The mark is legible with the ring removed (it degrades to
`PASS` with a strike-through), which matters at 24px.

**Sizes.** One SVG, one geometry, scaled:
`24px` favicon (ring stroke drops to `1px`, dot to `2.5px`, the reticle
crosshair is dropped because it does not survive 24px) · `40px` topbar (full
geometry) · `120px` Landing hero (full geometry, signal line extended `24px`).
Minimum size `16px`; below that the wordmark is not used, only `LogoMark`.

**Placement.** Topbar left, Landing hero at `--type-display-hero-size`, `icon.svg`
for the browser tab, `apple-icon.png` at 180px, OG image. Never rotated, never
outlined, never in a container chip.

### 14.15 Overflow discipline (reinforces §8.5)

The operator reported overflows and elements overlapping. The causes were
mechanical and are closed here as rules, not as fixes to particular screens:

1. **Every grid child gets `min-width: 0`.** Without it a long unbroken token
   (a price, a handle, a URL) sets the child's min-content width and pushes the
   whole grid past the viewport. This is the single most common cause.
2. **Every data figure is `white-space: nowrap`** (§11.1) **and** its container
   is `overflow: hidden; text-overflow: ellipsis`. A figure that wraps reads as
   two numbers; a figure that overflows reads as a broken layout.
3. **A handle or ticker truncates, never wraps**: `max-inline-size` on the
   element plus the ellipsis pair above.
4. **The hero wash, the grain layer and the ghost watermark are `position:
   absolute` inside a `position: relative` shell with `overflow: clip`.** An
   absolutely positioned wash that escapes its shell is exactly the "overlay on
   other elements" report.
5. **Nothing is `position: fixed` except the topbar and the bottom nav**, and
   neither has a z-index above the overlay tier (§5.4).
6. **No element may exceed `100%` of its parent's content box.** The grid, the
   card and the table cell are the three places to check.
