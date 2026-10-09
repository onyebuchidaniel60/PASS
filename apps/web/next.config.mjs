import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build-time gate for the component gallery (design/DESIGN.md §10.15).
 *
 * The gallery must not exist in a production build. A runtime check cannot
 * achieve that: Next.js compiles every module under `app/`, so both a runtime
 * `return null` and a runtime `notFound()` left the route in
 * `app-path-routes-manifest.json` and the gallery source in `page.js`. That was
 * verified by building and grepping, after 18 unit tests had already passed.
 *
 * So the gate is applied to MODULE RESOLUTION instead. The route re-exports
 * through the `#gallery` specifier, and in production that specifier resolves to
 * `src/gallery/stub.tsx` — a module whose entire body is `notFound()`. The real
 * implementation is never resolved, so it cannot be bundled, in a page chunk, a
 * shared chunk, or anywhere else.
 *
 * Verified after every change to this file or to src/gallery/:
 *
 *   pnpm --filter @pass/web build
 *   grep -r "narrow-width stress" apps/web/.next    -> must be empty
 *   grep -r "component gallery"    apps/web/.next    -> must be empty
 *
 * A non-empty result means the gate is broken. Do not deploy.
 */
const isProduction = process.env.NODE_ENV === "production";

// Stage B: same-origin session via Next rewrite proxy.
//
// The browser must never call the Railway API domain directly. A
// SameSite=Lax session cookie is not sent on cross-site fetch, so a
// cross-origin /me can never see the session the OAuth callback wrote.
// All browser traffic goes to same-origin /api/v1/* (and /health), which
// Next proxies to the API. The Set-Cookie then comes back via the Vercel
// domain, so the cookie is Vercel-scoped and Lax is correct (it stays Lax;
// relaxing to None would weaken the spec to make the bug pass, which
// AGENTS.md forbids). Server components keep using NEXT_PUBLIC_API_URL
// directly (see src/lib/api.ts); only browser fetches go through here.
const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000").replace(
  /\/$/,
  "",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source directly.
  transpilePackages: ["@pass/contracts", "@pass/ui"],
  eslint: { ignoreDuringBuilds: true },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiBase}/api/v1/:path*`,
      },
      {
        source: "/health",
        destination: `${apiBase}/health`,
      },
    ];
  },

webpack(config) {
    if (isProduction) {
      // Replace the gallery implementation with the notFound stub BEFORE
      // resolution, so the implementation is never part of the module graph.
      config.resolve.alias["pass-gallery"] = path.join(here, "src/gallery/stub.tsx");
    } else {
      config.resolve.alias["pass-gallery"] = path.join(here, "src/gallery/impl.tsx");
    }
    return config;
  },
};

export default nextConfig;
