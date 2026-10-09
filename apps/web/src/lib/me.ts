/**
 * The slice of `GET /api/v1/me` the web client reads.
 *
 * The API returns a FLAT payload: identity state lives in `connections[]`,
 * one entry per provider. There is no nested `x` object — an earlier
 * `XIdentityControl` assumed one (`me.x.connected`), which compiled because
 * `clientGet<T>` is an unchecked cast and crashed every signed-in page with
 * `TypeError: Cannot read properties of undefined (reading 'connected')`.
 * Every reader must go through the selectors below so the derivation is
 * total: a missing entry yields `null`/`false`, never a throw.
 *
 * SINGLE-STATE RULE (one place, stated once): an account's UI renders only
 * while that account is connected, and "connected" has exactly one meaning
 * per account —
 *
 * - X connected: `connections[x].connected === true` (the server folds
 *   live-token presence, expiry, and soft-disconnect into that boolean;
 *   the client MUST NOT re-derive it from row existence or labels).
 * - Wallet connected: a linked `tradingAccounts` row AND a live browser
 *   wallet session (`useAccount().isConnected`). The server knows only the
 *   first half, the browser only the second — `isWalletConnected` takes
 *   both and they are never collapsed into one boolean anywhere in the UI.
 * - Ethos visible: X connected AND `connections[ethos].connected`.
 *
 * Disconnected renders nothing attributed, or a connect CTA. No "linked
 * but inactive" states exist.
 */
export interface MeConnection {
  provider: string;
  connected: boolean;
  label: string;
  displayOnly: boolean;
  /** Machine-readable handle. Null when unconnected. Never parse `label`. */
  handle?: string | null;
}

export interface MePayload {
  userId: string;
  profileSlug: string | null;
  displayName: string | null;
  /** First-time tour completion (D-022). Null means never completed. */
  tourCompletedAt?: string | null;
  connections: MeConnection[];
  tradingAccounts: MeTradingAccount[];
}

export interface MeTradingAccount {
  id: string;
  accountAddress: string;
  agentAddress: string | null;
  isPrimary: boolean;
}

/** Minimal shape every connection reader accepts. Provider match is exact. */
export interface ConnectionLike {
  provider: string;
  connected: boolean;
  displayOnly?: boolean;
  handle?: string | null;
}

/** The named entry of a connections list, or null when absent. Never throws. */
export function connectionByName<C extends ConnectionLike>(
  conns: readonly C[] | null | undefined,
  provider: string,
): C | null {
  if (!Array.isArray(conns)) return null;
  return (
    conns.find(
      (c) => typeof c?.provider === "string" && c.provider.toLowerCase() === provider,
    ) ?? null
  );
}

/** The X entry of `connections[]`, or null when absent. Never throws. */
export function xConnection(me: Pick<MePayload, "connections"> | null | undefined): MeConnection | null {
  if (!me || !Array.isArray(me.connections)) return null;
  return connectionByName(me.connections, "x");
}

/** The Ethos entry of `connections[]`, or null when absent. Never throws. */
export function ethosConnection(
  me: Pick<MePayload, "connections"> | null | undefined,
): MeConnection | null {
  if (!me || !Array.isArray(me.connections)) return null;
  return connectionByName(me.connections, "ethos");
}

/** True when X is connected with a usable handle. Never throws. */
export function isXConnected(me: Pick<MePayload, "connections"> | null | undefined): boolean {
  const entry = xConnection(me);
  return Boolean(entry?.connected && entry.handle);
}

/** Server-side X liveness (section gating). Never throws. */
export function isXLive(
  me: { connections?: readonly ConnectionLike[] | null } | null | undefined,
): boolean {
  return connectionByName(me?.connections, "x")?.connected === true;
}

/** Ethos visibility: X connected AND Ethos connected. Never throws. */
export function isEthosVisible(
  me: { connections?: readonly ConnectionLike[] | null } | null | undefined,
): boolean {
  return isXLive(me) && connectionByName(me?.connections, "ethos")?.connected === true;
}

/** True when at least one Hyperliquid account is linked. Never throws. */
export function hasTradingAccount(
  me: Pick<MePayload, "tradingAccounts"> | null | undefined,
): boolean {
  return Array.isArray(me?.tradingAccounts) && me.tradingAccounts.length > 0;
}

/**
 * Single user-facing wallet state: a linked row AND a live browser wallet
 * session. Either half alone renders disconnected — there is no
 * "linked but inactive" UI.
 */
export function isWalletConnected(
  me: { tradingAccounts?: readonly unknown[] | null } | null | undefined,
  browserConnected: boolean,
): boolean {
  const list = me?.tradingAccounts;
  return browserConnected && Array.isArray(list) && list.length > 0;
}
