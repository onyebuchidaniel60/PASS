import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * docs/DATA_MODEL.md is the source of truth for this schema.
 * D-018.4 adds UNIQUE(trader_id, slug) on passes.
 * D-018.5 makes pass_versions the source of truth for execution-relevant
 * versions.
 * D-018.6 fixes the role of identities, x_connections, ethos_profiles.
 */

export const passStatusEnum = pgEnum("pass_status", [
  "draft",
  "active",
  "entry_pending",
  "open",
  "tp_hit",
  "sl_hit",
  "manually_closed",
  "expired",
  "cancelled",
  "invalidated",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "deleted",
]);

export const providerEnum = pgEnum("provider", ["hyperliquid", "ethos", "x"]);

export const identityProviderEnum = pgEnum("identity_provider", ["x", "ethos"]);

export const directionEnum = pgEnum("direction", ["long", "short"]);

export const entryTypeEnum = pgEnum("entry_type", ["market", "limit"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  status: userStatusEnum("status").notNull().default("active"),
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    slug: text("slug").notNull().unique(),
    handle: text("handle"),
    name: text("name").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profiles_slug_idx").on(t.slug)],
);

/**
 * Public identity binding, one row per provider per user (D-018.6).
 * Carries no secret material.
 */
export const identities = pgTable(
  "identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: identityProviderEnum("provider").notNull(),
    providerSubjectId: text("provider_subject_id").notNull(),
    username: text("username"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("identities_provider_subject_idx").on(
      t.provider,
      t.providerSubjectId,
    ),
    index("identities_user_idx").on(t.userId),
  ],
);

/**
 * X OAuth token material (D-018.6). Encrypted at rest, never exposed by any
 * public endpoint. A user may have an identities row for X without a row here.
 */
export const xConnections = pgTable(
  "x_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    xUserId: text("x_user_id").notNull().unique(),
    xHandle: text("x_handle").notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("x_connections_x_user_idx").on(t.xUserId)],
);

/**
 * account_address is the query subject for all Info API reads.
 * agent_address is a signer only (D-018.3, docs/TECHNICAL_SPEC.md §8).
 */
export const tradingAccounts = pgTable(
  "trading_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: providerEnum("provider").notNull().default("hyperliquid"),
    accountAddress: text("account_address").notNull(),
    agentAddress: text("agent_address"),
    agentApprovedAt: timestamp("agent_approved_at", { withTimezone: true }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trading_accounts_provider_address_idx").on(
      t.provider,
      t.accountAddress,
    ),
    index("trading_accounts_user_idx").on(t.userId),
  ],
);

export const passes = pgTable(
  "passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull().unique(),
    traderId: uuid("trader_id")
      .notNull()
      .references(() => users.id),
    slug: text("slug").notNull(),
    /** Current published version. Historical versions live in pass_versions. */
    version: integer("version").notNull().default(1),
    asset: text("asset").notNull(),
    dex: text("dex"),
    direction: directionEnum("direction").notNull(),
    entryType: entryTypeEnum("entry_type").notNull(),
    entryPrice: numeric("entry_price"),
    stopLoss: numeric("stop_loss"),
    takeProfit: numeric("take_profit"),
    leverage: numeric("leverage"),
    thesis: text("thesis").notNull(),
    status: passStatusEnum("status").notNull().default("draft"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // D-018.4: slug is unique per (trader_id, slug).
    uniqueIndex("passes_trader_slug_idx").on(t.traderId, t.slug),
    index("passes_public_id_idx").on(t.publicId),
    index("passes_status_published_idx").on(t.status, t.publishedAt),
    index("passes_trader_created_idx").on(t.traderId, t.createdAt),
  ],
);

/**
 * D-018.5: immutable snapshots of every execution-relevant version.
 * Every execution's (pass_id, pass_version) must always resolve here.
 */
export const passVersions = pgTable(
  "pass_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("pass_versions_pass_version_idx").on(t.passId, t.version),
  ],
);

export const passEvents = pgTable(
  "pass_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id),
    passVersion: integer("pass_version"),
    eventType: text("event_type").notNull(),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [index("pass_events_pass_at_idx").on(t.passId, t.eventAt)],
);

/**
 * References a specific (pass_id, pass_version). Historical execution must
 * remain reproducible after later Pass edits (D-018.5).
 */
export const executions = pgTable(
  "executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    passId: uuid("pass_id")
      .notNull()
      .references(() => passes.id),
    passVersion: integer("pass_version").notNull(),
    takerUserId: uuid("taker_user_id")
      .notNull()
      .references(() => users.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id),
    clientRequestId: text("client_request_id").notNull().unique(),
    providerOrderId: text("provider_order_id"),
    providerStatus: text("provider_status").notNull().default("unknown"),
    side: text("side").notNull(),
    positionSize: numeric("position_size").notNull(),
    leverage: numeric("leverage"),
    requestedEntry: numeric("requested_entry"),
    actualEntry: numeric("actual_entry"),
    stopLoss: numeric("stop_loss"),
    takeProfit: numeric("take_profit"),
    status: passStatusEnum("status").notNull().default("entry_pending"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    realizedPnl: numeric("realized_pnl"),
    fees: numeric("fees"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("executions_taker_created_idx").on(t.takerUserId, t.createdAt),
    index("executions_pass_created_idx").on(t.passId, t.createdAt),
    index("executions_provider_order_idx").on(t.providerOrderId),
  ],
);

/**
 * Cached Ethos reputation snapshot, refreshed periodically. Read-only from
 * the public API (D-018.6). Never a trust verdict.
 */
export const ethosProfiles = pgTable(
  "ethos_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    providerProfileId: text("provider_profile_id"),
    credibilityScore: numeric("credibility_score"),
    reviewsCount: integer("reviews_count"),
    vouchesCount: integer("vouches_count"),
    humanVerified: boolean("human_verified"),
    sourceUrl: text("source_url"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    rawSummary: jsonb("raw_summary").$type<Record<string, unknown>>(),
  },
  (t) => [index("ethos_profiles_provider_idx").on(t.providerProfileId)],
);

export const follows = pgTable(
  "follows",
  {
    followerUserId: uuid("follower_user_id")
      .notNull()
      .references(() => users.id),
    followedUserId: uuid("followed_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerUserId, t.followedUserId] })],
);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Server-side session records. HttpOnly cookie holds only the session id. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** OAuth state/PKCE artifacts (docs/SECURITY_SPEC.md §8, §9). */
export const oauthStates = pgTable(
  "oauth_states",
  {
    state: text("state").primaryKey(),
    provider: text("provider").notNull(),
    redirectTo: text("redirect_to"),
    codeVerifier: text("code_verifier"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("oauth_states_expiry_idx").on(t.expiresAt)],
);

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type IdentityRow = typeof identities.$inferSelect;
export type XConnectionRow = typeof xConnections.$inferSelect;
export type TradingAccountRow = typeof tradingAccounts.$inferSelect;
export type PassRow = typeof passes.$inferSelect;
export type PassVersionRow = typeof passVersions.$inferSelect;
export type PassEventRow = typeof passEvents.$inferSelect;
export type ExecutionRow = typeof executions.$inferSelect;
export type EthosProfileRow = typeof ethosProfiles.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;