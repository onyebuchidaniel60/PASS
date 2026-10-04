import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { corsOrigins } from "@pass/contracts";
import type { AppContext } from "./context.js";
import { createLogger } from "./logger.js";
import { isAppError, toErrorResponse } from "./errors.js";
import { loadSession } from "./plugins/session.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerPassRoutes } from "./routes/pass.js";
import { registerExecutionRoutes } from "./routes/pass.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerShareRoutes } from "./routes/share.js";

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  const log = createLogger("http");

  await app.register(cookie, {
    secret: ctx.env.SESSION_SECRET ?? undefined,
  });

  // Action endpoints such as /publish, /cancel and /logout legitimately take
  // no body. Fastify's default parser rejects an empty body when a JSON
  // content-type is present, so treat an empty body as an empty object.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      const raw = typeof body === "string" ? body.trim() : "";
      if (raw === "") return done(null, {});
      try {
        done(null, JSON.parse(raw));
      } catch (err) {
        const e = err as Error & { statusCode?: number };
        e.statusCode = 400;
        done(e, undefined);
      }
    },
  );
  /**
   * CORS.
   *
   * The PASS web app is the normal browser caller. The Chrome extension is
   * also a legitimate caller: its pages and service worker send an Origin of
   * chrome-extension://<id>, which must be accepted explicitly. The ID is
   * assigned by Chrome and differs per install and per profile, so the
   * extension origin is matched by scheme rather than by an exact string.
   *
   * A wildcard is deliberately NOT used: the API is credentialed
   * (HttpOnly session cookies), and `Access-Control-Allow-Origin: *` is
   * illegal alongside credentials. moz-extension:// is included so a future
   * Firefox build needs no API change.
   *
   * Local dev origins are added only outside production.
   */
  const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension):\/\/[a-z0-9-]+$/i;

  await app.register(cors, {
    origin: (origin, cb) => {
      // Same-origin and non-browser callers send no Origin header.
      if (!origin) return cb(null, true);
      if (EXTENSION_ORIGIN.test(origin)) return cb(null, true);
      if (corsOrigins(ctx.env).includes(origin)) return cb(null, true);
      if (
        ctx.env.NODE_ENV !== "production" &&
        (origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000")
      ) {
        return cb(null, true);
      }
      cb(null, false);
    },
    credentials: true,
  });

  app.addHook("onRequest", async (req) => {
    req.sessionUserId = await loadSession(ctx, req);
  });

  app.setErrorHandler((err, req, reply) => {
    const requestId = String(
      (req.headers["x-request-id"] as string | undefined) ?? `req_${Date.now().toString(36)}`,
    );
    const { status, body } = toErrorResponse(err);

    if (isAppError(err)) {
      if (status >= 500) log.error(err.message, { code: err.code, path: req.url });
      else log.debug(err.message, { code: err.code, path: req.url });
    } else {
      log.error("unhandled error", {
        path: req.url,
        reason: err instanceof Error ? err.message : String(err),
        // Never log request bodies: they may carry signed payloads.
      });
    }

    reply.status(status).send({ ...body, requestId });
  });

  app.get("/health", async () => ({
    status: "ok",
    env: ctx.env.NODE_ENV,
    modes: ctx.adapters.modes,
    demoMode: ctx.demoMode,
    time: new Date().toISOString(),
  }));

  await registerPublicRoutes(app, ctx);
  await registerAuthRoutes(app, ctx);
  await registerPassRoutes(app, ctx);
  await registerExecutionRoutes(app, ctx);
  await registerIntegrationRoutes(app, ctx);
  await registerShareRoutes(app, ctx);

  return app;
}