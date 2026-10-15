/**
 * Shared venue limits. Single source of truth for the client and the API —
 * neither side hard-codes its own copy (docs/DECISIONS.md D-018.8: the
 * contract owns shared values; both trust boundaries import them from here).
 */

/**
 * Hyperliquid rejects orders below a $10 notional with
 * `statuses[0].error: "Order must have minimum value of $10. ..."`.
 * The execution preview refuses smaller sizes before the user signs, and
 * the relay surfaces the venue's own message verbatim when it slips
 * through (e.g. price moved between preview and submit).
 */
export const MIN_ORDER_VALUE_USD = 10;

/**
 * Hyperliquid maximum leverage accepted by PASS. The venue rejects anything
 * above this, so the Create form, the Take stepper, the API schemas and
 * server validation all cap here. Per-asset venue limits below this ceiling
 * are out of scope and continue to apply at the venue.
 */
export const MAX_LEVERAGE = 10;
