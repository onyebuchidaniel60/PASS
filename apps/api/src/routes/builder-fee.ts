import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { BUILDER_FEE_RATE_PERCENT } from "@pass/domain";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import { currentVenue } from "../services/venue.js";

/**
 * Relay a master-signed `approveBuilderFee` action.
 *
 * Hyperliquid requires the account owner to approve the builder's maximum fee
 * rate before an order carrying `builder` is accepted. The browser signs the
 * EIP-712 payload; PASS relays it and never receives a private key.
 */

const ApproveBuilderFeeBody = z
  .object({
    nonce: z.number().int().positive(),
    signature: z.record(z.unknown()),
  })
  .strict();

export async function registerBuilderFeeRoutes(
  app: FastifyInstance,
  ctx: AppContext,
) {
  app.post<{ Params: { address: string } }>(
    "/api/v1/trading-accounts/:address/approve-builder-fee",
    async (req) => {
      const body = ApproveBuilderFeeBody.parse(req.body);
      const normalized = req.params.address.trim().toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
        throw new AppError("INVALID_REQUEST", "That is not a valid EVM address.");
      }
      const builder = ctx.env.HYPERLIQUID_BUILDER_ADDRESS?.toLowerCase();
      if (!builder) {
        throw new AppError(
          "INVALID_REQUEST",
          "Builder fees are not configured for this deployment.",
        );
      }

      const relayLabel = currentVenue(ctx) === "testnet" ? "Testnet" : "Mainnet";
      try {
        await ctx.adapters.hyperliquid.relayApproveBuilderFee({
          builder,
          maxFeeRate: BUILDER_FEE_RATE_PERCENT,
          nonce: body.nonce,
          signature: body.signature,
          hyperliquidChain: relayLabel,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/reject|recover signer|err/i.test(msg)) {
          throw new AppError(
            "SIGNATURE_REJECTED",
            `Hyperliquid rejected the builder fee approval: ${msg.slice(0, 200)}`,
          );
        }
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          `Could not reach Hyperliquid: ${msg.slice(0, 160)}`,
        );
      }

      return {
        ok: true,
        builder,
        maxFeeRate: BUILDER_FEE_RATE_PERCENT,
        mode: ctx.adapters.hyperliquid.mode,
      };
    },
  );
}
