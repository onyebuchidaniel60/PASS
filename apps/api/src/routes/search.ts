import type { FastifyInstance } from "fastify";
import { and, desc, eq, ilike, ne, or } from "drizzle-orm";

import type { SearchDto, SearchPassDto, SearchTraderDto } from "@pass/contracts";
import { passes, profiles } from "@pass/db";
import type { AppContext } from "../context.js";

/**
 * Public global search.
 *
 * Traders and Passes are returned separately, each capped at five. The search
 * is deliberately case-insensitive and substring-based: a user typing "btc"
 * expects the BTC Passes, and a user typing a handle fragment expects the
 * trader. Drafts never surface because a draft has no public URL.
 */

const LIMIT = 5;

function traderDto(row: {
  slug: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
}): SearchTraderDto {
  return {
    slug: row.slug,
    handle: row.handle,
    displayName: row.name,
    avatarUrl: row.avatarUrl,
  };
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  ctx: AppContext,
) {
  app.get<{ Querystring: { q?: string } }>("/api/v1/search", async (req) => {
    const query = (req.query.q ?? "").trim();
    if (query.length === 0) {
      return { query: "", traders: [], passes: [] } satisfies SearchDto;
    }

    const pattern = `%${query}%`;

    const traderRows = await ctx.db
      .select({
        slug: profiles.slug,
        handle: profiles.handle,
        name: profiles.name,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(or(ilike(profiles.slug, pattern), ilike(profiles.name, pattern)))
      .orderBy(profiles.name)
      .limit(LIMIT);

    const passRows = await ctx.db
      .select({ pass: passes, profile: profiles })
      .from(passes)
      .innerJoin(profiles, eq(passes.traderId, profiles.userId))
      .where(
        and(
          ne(passes.status, "draft"),
          or(
            ilike(passes.asset, pattern),
            ilike(passes.publicId, pattern),
          ),
        ),
      )
      .orderBy(desc(passes.publishedAt), desc(passes.createdAt))
      .limit(LIMIT);

    const result: SearchDto = {
      query,
      traders: traderRows.map(traderDto),
      passes: passRows.map(({ pass, profile }) => {
        const trader = traderDto(profile);
        return {
          publicId: pass.publicId,
          asset: pass.asset,
          direction: pass.direction,
          status: pass.status,
          entryType: pass.entryType,
          entryPrice: pass.entryPrice,
          stopLoss: pass.stopLoss,
          takeProfit: pass.takeProfit,
          leverage: pass.leverage,
          publishedAt: pass.publishedAt ? pass.publishedAt.toISOString() : null,
          trader,
        } satisfies SearchPassDto;
      }),
    };

    return result;
  });
}
