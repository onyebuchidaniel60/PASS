/**
 * The slice of `GET /api/v1/me` the web client reads.
 *
 * The API returns a FLAT payload: identity state lives in `connections[]`,
 * one entry per provider. There is no nested `x` object — an earlier
 * `XIdentityControl` assumed one (`me.x.connected`), which compiled because
 * `clientGet<T>` is an unchecked cast and crashed every signed-in page with
 * `TypeError: Cannot read properties of undefined (reading 'connected')`.
 * Every reader must go through `xConnection` below so the derivation is
 * total: a missing entry yields `null`, never a throw.
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

/** The X entry of `connections[]`, or null when absent. Never throws. */
export function xConnection(me: Pick<MePayload, "connections"> | null | undefined): MeConnection | null {
  if (!me || !Array.isArray(me.connections)) return null;
  return me.connections.find((c) => c?.provider === "x") ?? null;
}

/** The Ethos entry of `connections[]`, or null when absent. Never throws. */
export function ethosConnection(
  me: Pick<MePayload, "connections"> | null | undefined,
): MeConnection | null {
  if (!me || !Array.isArray(me.connections)) return null;
  return me.connections.find((c) => c?.provider === "ethos") ?? null;
}

/** True when X is connected with a usable handle. Never throws. */
export function isXConnected(me: Pick<MePayload, "connections"> | null | undefined): boolean {
  const entry = xConnection(me);
  return Boolean(entry?.connected && entry.handle);
}

/** True when at least one Hyperliquid account is linked. Never throws. */
export function hasTradingAccount(
  me: Pick<MePayload, "tradingAccounts"> | null | undefined,
): boolean {
  return Array.isArray(me?.tradingAccounts) && me.tradingAccounts.length > 0;
}
