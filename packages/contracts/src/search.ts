import { z } from "zod";

import {
  IsoDateTime,
  PassDirection,
  PassStatus,
  PublicId,
} from "./common.js";

/**
 * Public global search.
 *
 * Two independent result sets, never merged into one ranked list: a trader and
 * a Pass are different objects, and the UI gives each its own section. The
 * response is capped server-side so the command palette cannot be made to
 * render an unbounded list.
 */

export const SearchTraderDto = z.object({
  slug: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
export type SearchTraderDto = z.infer<typeof SearchTraderDto>;

export const SearchPassDto = z.object({
  publicId: PublicId,
  asset: z.string(),
  direction: PassDirection,
  status: PassStatus,
  entryType: z.enum(["market", "limit"]),
  entryPrice: z.string().nullable(),
  stopLoss: z.string().nullable(),
  takeProfit: z.string().nullable(),
  leverage: z.string().nullable(),
  publishedAt: IsoDateTime.nullable(),
  trader: SearchTraderDto,
});
export type SearchPassDto = z.infer<typeof SearchPassDto>;

export const SearchDto = z.object({
  query: z.string(),
  traders: z.array(SearchTraderDto),
  passes: z.array(SearchPassDto),
});
export type SearchDto = z.infer<typeof SearchDto>;
