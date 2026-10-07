# PHASE_08 — Stage K.3 rebuild: wallet, Pass detail, Trader profile, Take flow

**Status: OPEN — awaiting operator verification.**
Nothing in this record is visually verified. This environment has no browser
automation (see [PHASE_00_tokens.md](./PHASE_00_tokens.md) §1), so "built" below
means "typechecks, lints, passes its assertions, builds, and serves" — not
"looked at and measured".

- **Date:** 2026-10-07
- **Scope:** the three video-critical screens, plus the wallet control.
- **Baseline deployed before this phase:** `c0b1b8e`
- **Deployed after this phase:** `832c7ac` → `https://pass-web-dun.vercel.app`

---

## 1. What this phase did

| # | Change | Commit |
|---|---|---|
| 1 | Wallet control: ConnectKit kept for modal only, PASS renders its own button | `4aa622e` |
| 2 | Pass detail rebuilt to §14 | `53aa1d1` |
| 3 | Pass-detail error state surfaces the API message | `956bafc` |
| 4 | Trader profile rebuilt to §14 | `63b73e0` |
| 5 | Take flow chrome rebuilt to §14 | `bddda4d` |
| 6 | Eight undefined token references resolved | `832c7ac` |

Tests went from 26 to 85 across the three screens. Full suite: **526 passing**
(45 root + 481 web), `pnpm run check` exit 0.

---

## 2. Decisions a reviewer should check

These are judgement calls where the brief and the design document disagreed.
Each one is reversible, and each is asserted in a test so a reversal is visible.

### 2.1 The Ethos score is rendered exactly once per screen

The K.3 brief listed "Ethos score" as a field on the trader mini-card. §11.4
says *one figure, one place*, and D-007 / PRD §12 make rendering reputation and
PASS performance in a way that reads as one number a P0 anti-pattern.

Resolution: on both Pass detail and the Trader profile the credibility score
belongs to `ReputationBlock` and the card around it does **not** restate it. Two
adjacent renderings of the same number is the merge §11.4 forbids, and it means
updating the number in two places when it changes in one.

Asserted: `passDetail.test.tsx` "states the Ethos score exactly once",
`traderProfile.test.tsx` "states the Ethos score exactly once across the screen".

### 2.2 The trader mini-card's profile link is not an accent control

The rebuild initially gave the mini-card a `DataCard action`. That is an
accent-filled control, and the Take Pass CTA on the same screen is already the
page's one accent. §2.5 rations the accent to one thing per viewport. Changed
to a §14.9 outlined chip.

Asserted: `passDetail.test.tsx` "keeps exactly one accent fill: the Take Pass CTA".

### 2.3 The Ethos and Performance cards on the profile are `Panel`, not `DataCard`

A §14.3 `DataCard` has a **mandatory** `value` slot set at `--type-data-xl`. The
Ethos card's only big figure belongs to `ReputationBlock`. Filling the slot with
the score duplicates it (§2.1); filling it with anything else sets a sentence at
2.5rem. So those two blocks use the hairline `Panel` frame, which has no figure
slot to misuse. The `DataCard` is still used where a big figure is correct — the
Active Passes cards, where the asset is the figure.

Asserted: `traderProfile.test.tsx` "frames each of the two blocks as a card".

### 2.4 Win rate, average R and TP-hit rate are NOT on the profile

The K.3 brief listed them as profile performance metrics. **The API does not
return them.** §10.2 forbids inventing figures, and deriving a win rate from a
published/completed counter would be a fabrication wearing a decimal point.

Resolution: the Performance card shows only what the API returns, and states in
plain text that the other three are not reported rather than estimated. If these
metrics are wanted, that is a backend change, not a frontend one.

Asserted: `traderProfile.test.tsx` "says the un-reported metrics are omitted".

### 2.5 The Take flow rebuild was chrome-only, by choice

The Take flow is where a Taker signs for their own money. Its behaviour was
already correct and fully asserted. The §14 work touched the page shell, the
step header, and the wash only. Explicitly unchanged: the empty size field
(D-015), the gated Authorize button, the plain-language statement above the
consent checkbox, the verbatim provider receipt, warnings-as-sentences, and the
absence of a stepper or countdown.

§14.1 names "the Take preview" as a `flat`-wash surface, so
`data-strength="flat"` is asserted rather than left to chance.

---

## 3. Defects found by the new assertions

These were live bugs at the time of writing, not theoretical:

1. **`tp_hit` / `sl_hit` rendered with no badge tone.** `PassDetailClient`'s
   lifecycle type omitted both states and the `TONE` map had no entry, so a
   take-profit hit rendered `data-tone="undefined"` — a badge with no state
   colour and no icon treatment, which is the exact failure §14.6 exists to
   prevent. Fixed, and the type now covers every state.
2. **Eight undefined CSS custom properties.** `--ink-primary`,
   `--ink-secondary`, `--ink-tertiary`, `--surface-1`, `--line-strong`,
   `--type-caption`, `--type-data-lg`, and `--font-mono` do not exist in this
   repo. Every declaration using them was silently inert: colours fell back to
   inherited, the eyebrow size and the trailing-card caption fell back to the
   browser default. Fixed in `832c7ac`.
3. **`pass-row-link-plain` had no rule at all.** The Pass-detail text link
   inherited the UA blue underline directly above the page's one accent
   control. Fixed.
4. **The Pass-detail error state discarded the API's message.** `error` was
   captured and never rendered, so an operator could not tell a timeout from a
   rejected request. Fixed in `956bafc`.

**Gap in our own tooling that let 2 through:** `scripts/check-design-tokens.mjs`
catches out-of-token *literal values* (`14px`, a hex colour) but does **not**
catch a `var()` that references a token which does not exist. A green token scan
is therefore not evidence that every token reference resolves. A `var()`
resolution check is the obvious next addition and is **not yet written**.

---

## 4. Verification actually performed

| Check | Result |
|---|---|
| `pnpm run check` (lint + typecheck + 526 tests + tokens + fonts) | exit 0 |
| `node scripts/check-design-tokens.mjs` | clean |
| `node scripts/check-contrast.mjs` | exit 0; one known residual (§2.4) |
| `pnpm --filter @pass/web build` | success, warnings only |
| `vercel --prod --yes --archive=tgz` | `readyState: READY` |
| Route sweep, live alias | see §5 |

The `FAIL 2.80:1` line in the contrast output is the **pre-existing,
DESIGN.md-mandated** `--color-text-disabled` residual under "KNOWN RESIDUALS",
not a regression. Exit code is 0.

### Encoding incident

`components.css` was rewritten with `Get-Content -Raw | Set-Content -Encoding
UTF8`, which `../BUILD_CONTINUATION.md` §9 explicitly forbids. Checked
afterwards: 0 U+FFFD, all 98 `§` intact, and `git diff --numstat` = 1/1. The only
residue was a BOM, now stripped. **The round-trip did not corrupt the file this
time, but it rewrote all 2,700 lines to achieve nothing and must not be
repeated.** `Add-Content -Encoding UTF8` was also used on the three test files;
those verified clean as well.

---

## 5. Live route sweep

`https://pass-web-dun.vercel.app` — 200: `/`, `/discover`, `/how-it-works`,
`/faqs`, `/help`, `/contact`, `/me/passes`, `/me/executions`, `/settings`,
`/onboarding`, `/passes/new`, `/p/UvvuxpWPZ4`, `/u/turnttfup99`,
`/passes/UvvuxpWPZ4/take`.

`/gallery` — 404. No route exists; unchanged from the baseline and not a defect.

---

## 6. What is still unverified

Everything visual. The operator checklist is
[`../BUILD_CONTINUATION.md`](../BUILD_CONTINUATION.md) §4. Specifically for this
phase:

1. **Pass detail** — bracket frame present; five metric cards and nothing else;
   R:R reads `1.73:1` and `—` correctly; the market snapshot shows a live dot
   only when a reading exists.
2. **Trader profile** — the two blocks read as visibly separate cards with a rule
   between them; reputation appears above performance; the grid wraps at 375px.
3. **Take flow** — the flat wash; the step title; the Authorize button still
   gated until consent.
4. **375px overflow** on all three, and 200% zoom.
5. **Reduced motion** — live dot must not pulse, sparkline fully drawn.
6. The nine `document.fonts.check` calls from `PHASE_00_tokens.md` §8.5, still
   outstanding from Stage K.