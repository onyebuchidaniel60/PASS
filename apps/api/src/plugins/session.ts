import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import type { AppContext } from "../context.js";
import { sessions } from "@pass/db";
import { AppError } from "../errors.js";
import { randomToken } from "../crypto.js";

export const SESSION_COOKIE = "pass_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

declare module "fastify" {
  interface FastifyRequest {
    sessionUserId?: string | null;
  }
}

export async function createSession(
  ctx: AppContext,
  userId: string,
): Promise<string> {
  const id = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await ctx.db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function destroySession(ctx: AppContext, id: string): Promise<void> {
  await ctx.db.delete(sessions).where(eq(sessions.id, id));
}

export function setSessionCookie(reply: FastifyReply, id: string, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

/**
 * Resolves the session cookie to a user id without rejecting the request.
 * Routes that require auth call requireUser themselves so they can return the
 * canonical AUTH_REQUIRED code.
 */
export async function loadSession(
  ctx: AppContext,
  req: FastifyRequest,
): Promise<string | null> {
  const id = req.cookies?.[SESSION_COOKIE];
  if (!id) return null;
  const rows = await ctx.db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await destroySession(ctx, id);
    return null;
  }
  return row.userId;
}

export async function requireUser(req: FastifyRequest): Promise<string> {
  if (!req.sessionUserId) {
    throw new AppError("AUTH_REQUIRED");
  }
  return req.sessionUserId;
}