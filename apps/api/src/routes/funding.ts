import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import { quoteNearIntents } from "../services/near-intents.js";

/**
 * NEAR Intents funding.
 *
 * A quote is informational: PASS never receives the user's funds. The user
 * pays the returned deposit address from their own wallet, and 1Click settles
 * USDC into their HyperCore account. When `isConfidential` is true the quote
 * carries `confidentiality: "basic"`, which routes the swap through NEAR's
 * private shard and breaks the on-chain link between funding wallet and
 * trading account.
 */

const QuoteBody = z
  .object({
    sourceChain: z.string().min(1),
    sourceToken: z.string().min(1),
    destinationAddress: z.string().min(8),
    amount: z.union([z.string(), z.number().positive()]).transform(String),
    isConfidential: z.boolean().default(false),
    /**
     * Optional refund destination for source chains whose address format
     * differs from the Hyperliquid account (for example Bitcoin). EVM and
     * Solana chains default to `destinationAddress`.
     */
    refundAddress: z.string().min(1).optional(),
  })
  .strict();

export async function registerFundingRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post("/api/v1/funding/intents/quote", async (req) => {
    const body = QuoteBody.parse(req.body);
    const quote = await quoteNearIntents(ctx.env, {
      sourceChain: body.sourceChain,
      sourceToken: body.sourceToken,
      destinationAddress: body.destinationAddress,
      amount: body.amount,
      isConfidential: body.isConfidential,
      refundAddress: body.refundAddress,
    });
    return {
      ...quote,
      poweredBy: "NEAR Intents",
      note: body.isConfidential
        ? "Confidential deposits hide the link between your funding wallet and your PASS trading account."
        : "Public deposits are visible on-chain and can be linked to your trading account.",
    };
  });
}
