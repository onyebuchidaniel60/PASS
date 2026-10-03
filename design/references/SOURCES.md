# PASS — Visual Reference Sources

The images in this folder were placed by the repository operator and are the direction `design/DESIGN.md` was authored against. They are **read-only**: do not move, rename, crop, optimise, or re-encode them.

Per `SKILL_FRONTEND_DESIGN.md` §4, reference images are direction, not specification. Do not copy layout, do not reproduce branding, do not lift the reference's type family, and do not reproduce the reference's dummy data or placeholder values.

---

## The reference set

All thirteen images are frames from a single dark, ember-accented trading-terminal design system. They are listed here for **feel, density, hierarchy, tone, and colour discipline only**.

| File | Reference for |
|---|---|
| `reference (1).png` | **Hierarchy and feel.** One short statement line, then a stacked column of large proof figures, each with its label beneath. Establishes the dark, calm, ember-lit register PASS opens with. |
| `reference (2).png` | **Grid and section discipline.** The structural-grid diagram, plus the `// LABEL \\` eyebrow with its section number set at the opposite edge — the convention PASS adopts verbatim for §10's section headers. |
| `reference (3).png` | **Tone and the signature device.** The anti-hype register of a declarative two-line headline, and the horizontal beam/scanline with a reticle node — the direct ancestor of PASS's `SignalLine`. |
| `reference (4).png` | **Density of a numbered process block.** Four corner-bracket panels, each numbered, each with an image and a mono caption. Informs PASS's density for multi-step and verification surfaces. |
| `reference (5).png` | **Instrument density.** How much real market and order data can sit inside one frame — ticker, list, chart, order book, summary — and still read as calm rather than cluttered. The ceiling PASS holds itself to. |
| `reference (6).png` | **Type scale and colour discipline.** Enormous display type against small body copy, and exactly one accent-emphasised word per headline. The rationing rule behind PASS's §2.5 accent budget. |
| `reference (7).png` | **Feel of the beam device and panel framing.** The signal line crossing a dark field, a reticle node on it, and small corner-bracket entity panels floating beside it. |
| `reference (8).png` | **Restraint of chrome and controls.** A single saturated field carrying one neutral device and nothing else. Informs PASS's rule that one viewport gets one accent element. |
| `reference (9).png` | **Tone of statement typography at scale.** Confident, declarative wordmark-scale type with a small tracked mono label. Feeds PASS's §1.3 copy register, not its branding. |
| `reference (10).png` | **Status treatment.** Lifecycle state rendered as mono text plus colour, never colour alone — `PENDING` and `VERIFIED` side by side. The direct model for PASS's `StatusChip` rules in §11.7. |
| `reference (11).png` | **Precision motif.** Beam, orbit, and reticle geometry as an identity device rather than an illustration. The source of PASS's `Reticle` and `CoordinatePair` motifs. |
| `reference (12).png` | **Card-row hierarchy and realistic data magnitude.** A row of market cards with headline figure, delta, volume, and verification state, plus an absolute mono timestamp. |
| `reference (13).png` | **Type *roles*, never type *families*.** Confirms the three-role structure PASS adopts — display for headlines, a clean sans for body, monospace for **all** data. The specific families named in this frame are **deliberately not used** by PASS; see the note below. |

---

## Two notes on how this set was used

### The type families were deliberately not adopted

`reference (13).png` names its own heading, body, and data families. `SKILL_FRONTEND_DESIGN.md` §4 forbids lifting a reference's type family, so PASS specifies its own:

| Role | Reference used | PASS uses |
|---|---|---|
| Display | _named in reference 13_ | **Archivo** |
| Body | _named in reference 13_ | **Inter Tight** |
| Data | _named in reference 13_ | **IBM Plex Mono** |

What was taken from the reference is the **role structure** — display for headlines, a clean sans for prose, monospace for every numeric and identifier — not the letterforms. See `design/DESIGN.md` §3.1.

### Fixtures must not use the reference's values

The reference's figures are short samples chosen to lay out cleanly. Per §4 they are not representative and they hide the layout defects real values expose. Every PASS fixture — in tests, in the gallery's stress section, and in any demo path — must use realistic magnitudes from PASS's own domain: five-figure perp prices, full 0x addresses, realistic position sizes, and Pass ids of realistic length.

---

## Adding a reference later

If a further image is added to this folder, add it to the table above with a one-line note on what it is a reference for, and do not change any existing row. If an existing row's note becomes wrong because a decision changed, correct the note in the same commit that changed the decision, and say so in that commit's message.

Do not add an image to justify a visual decision that `design/DESIGN.md` does not already make.