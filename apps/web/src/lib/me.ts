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
  connections: MeConnection[];
}

/** The X entry of `connections[]`, or null when absent. Never throws. */
export function xConnection(me: Pick<MePayload, "connections"> | null | undefined): MeConnection | null {
  if (!me || !Array.isArray(me.connections)) return null;
  return me.connections.find((c) => c?.provider === "x") ?? null;
}
