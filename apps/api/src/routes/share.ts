import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import { requireUser } from "../plugins/session.js";
import { getPassByPublicId } from "../services/pass-service.js";
import { readXAccessToken } from "../services/profile-service.js";
import { AppError } from "../errors.js";
import { fmtCompact, statusLabel } from "./share-format.js";

/**
 * docs/API_CONTRACTS.md §5 and §16 — sharing.
 *
 * Copy-only sharing is always available. Native X posting is optional and
 * must never be required (Stage H gate). A Pass always has a stable public
 * URL; /p/{publicId} is authoritative (D-018.4).
 */
export async function registerShareRoutes(app: FastifyInstance, ctx: AppContext) {
  const Request = z
    .object({ passId: z.string().min(4).max(32), mode: z.enum(["copy", "post"]) })
    .strict();

  app.post("/api/v1/sharing/x", async (req) => {
    const userId = await requireUser(req);
    const input = Request.parse(req.body);

    const pass = await getPassByPublicId(ctx, input.passId);
    if (pass.traderId !== userId) {
      throw new AppError("FORBIDDEN", "Only the owning Trader can share this Pass.");
    }

    const shareUrl = `${ctx.env.APP_URL}/p/${pass.publicId}`;
    const shareText = buildShareText(pass, shareUrl);

    // Copy-only is the default and never depends on the posting API.
    if (input.mode === "copy") {
      return { shareUrl, shareText, xPostId: null, xPostUrl: null, copyOnly: true };
    }

    const token = await readXAccessToken(ctx, userId);
    if (!token) {
      // No stored token: fall back to copy-only rather than failing.
      return {
        shareUrl,
        shareText,
        xPostId: null,
        xPostUrl: null,
        copyOnly: true,
        reason: ctx.adapters.x.mode === "live" ? "IDENTITY_NOT_CONNECTED" : "X_MODE=mock",
      };
    }

    try {
      const post = await ctx.adapters.x.createPost(token, shareText);
      return {
        shareUrl,
        shareText,
        xPostId: post.postId,
        xPostUrl: post.url,
        copyOnly: false,
      };
    } catch (err) {
      // A posting failure must not remove the ability to share.
      ctx.log.warn("x post failed; falling back to copy-only", {
        passId: pass.publicId,
        reason: err instanceof Error ? err.message : String(err),
      });
      return {
        shareUrl,
        shareText,
        xPostId: null,
        xPostUrl: null,
        copyOnly: true,
        reason: "ORDER_REJECTED",
      };
    }
  });
}

function buildShareText(
  pass: {
    asset: string;
    direction: string;
    entryPrice: string | null;
    takeProfit: string | null;
    stopLoss: string | null;
    status: string;
  },
  shareUrl: string,
): string {
  const parts = [`${pass.asset} ${pass.direction.toUpperCase()}`, statusLabel(pass.status)];
  if (pass.entryPrice) parts.push(`Entry $${fmtCompact(pass.entryPrice)}`);
  if (pass.takeProfit) parts.push(`TP $${fmtCompact(pass.takeProfit)}`);
  if (pass.stopLoss) parts.push(`SL $${fmtCompact(pass.stopLoss)}`);
  return `${parts.join(" · ")}\n\nSee a trade. Know the trader. Take the trade.\n${shareUrl}`;
}