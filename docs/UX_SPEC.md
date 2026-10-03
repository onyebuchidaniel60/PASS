# PASS — UX Specification

**Status:** Source of truth for interaction and information hierarchy.

## 1. Design direction

PASS should feel like a modern crypto product without becoming a casino-style trading interface.

Priorities:

1. clarity;
2. confidence in what will happen next;
3. speed of understanding;
4. visible risk parameters;
5. minimal friction to take a specific trade;
6. strong identity context.

Avoid clutter, excessive charting, and decorative crypto tropes.

## 2. Core terminology

Use:

- Pass;
- Trade Plan;
- Trader;
- Taker;
- Take Pass;
- Active;
- Entry Pending;
- Open;
- Closed.

Avoid calling Passes "signals" in primary UI.

## 3. Global navigation

Recommended:

```text
PASS
Discover     My Passes     Executions     Profile
```

Authenticated dashboard may use a compact sidebar on desktop and bottom/condensed navigation on mobile.

## 4. Landing page

Hero:

> See a trade. Know the trader. Take the trade.

Support:

> PASS turns Hyperliquid trade plans into shareable, executable links.

Primary CTA: `Explore Passes`
Secondary CTA: `Create a Pass`

Show the product loop visually:

`X post -> Pass -> trader context -> trade plan -> Hyperliquid`

## 5. Public Pass page

The Pass page is the core conversion surface.

Information order:

### A. Status

```text
ENTRY PENDING
```

or current lifecycle state.

### B. Trade

```text
BTC
LONG
```

### C. Trader

```text
@TraderX
X
Ethos 1,742
```

### D. Plan

```text
Entry     $113,400
TP        $116,000
SL        $111,900
Leverage  5x
```

### E. Thesis

Short readable explanation.

### F. Market context

Current mark/mid with timestamp.

### G. Takers/metrics

Only show verified PASS-owned metrics.

### H. CTA

`TAKE PASS`

## 6. Trader profile

Header:

```text
Avatar
@TraderX
BTC / ETH Perp Trader
X connected
Ethos 1,742
```

Trading section:

- published Passes;
- completed Passes;
- Pass success metric;
- observed account context where legitimately available.

Reputation section:

- Ethos score;
- reviews;
- vouches;
- human verification if available;
- external profile link.

Active Passes section.

Never merge reputation and performance into one trust label.

## 7. Create Pass

Use a progressive but single-page form if possible.

Fields:

1. Asset
2. Long/Short
3. Entry type
4. Entry price if limit
5. Stop loss
6. Take profit
7. Leverage
8. Thesis
9. Expiry

Provide live validation:

- price ordering;
- supported market;
- leverage constraints;
- expiry validity;
- TP/SL direction consistency.

Preview before publishing.

## 8. Take flow

### Step 1 — choose size

The Taker enters the amount they personally want to deploy.

Do not make the Trader's position size the default unless it is clearly informational.

### Step 2 — execution preview

Show:

- Pass version;
- current market price;
- intended order;
- size;
- leverage;
- TP/SL;
- slippage tolerance;
- warnings.

### Step 3 — authorization

Explain in plain language what will happen.

### Step 4 — confirmation

Show provider order ID/status after submission.

## 9. Stale Pass behavior

If a Pass changes after the page loaded or if the current market invalidates the plan:

```text
This Pass changed.

The trade parameters you reviewed are no longer current.

[Review latest Pass]
```

Never silently execute stale parameters.

## 10. Error states

Every provider-dependent screen must have:

- loading;
- unavailable;
- retry;
- stale data indication;
- permission/auth required;
- execution rejected.

## 11. Mobile

The most important information must remain above the fold:

- asset + direction;
- trader;
- reputation context;
- entry/TP/SL;
- status;
- Take Pass CTA.

Execution review must be comfortable with one hand.

## 12. Accessibility

- semantic HTML;
- visible focus states;
- sufficient contrast;
- keyboard execution path;
- descriptive labels;
- no status communicated only by color;
- reduced-motion support.

## 13. Extension handoff

The extension should surface a small amount of context and use an explicit action:

`View Pass`

The user should transition to the web app for full trade details and execution.

## 14. Social preview

Pass pages should produce useful Open Graph metadata:

```text
PASS
BTC LONG
@TraderX
Entry $113.4K • TP $116K • SL $111.9K
```

Do not expose private account data in metadata.
