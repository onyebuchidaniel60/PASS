/**
 * Build-time configuration for the PASS extension.
 *
 * Values come from Vite env vars so the same source builds against local dev
 * or the live deployment. These are PUBLIC URLs; nothing secret may ever be
 * placed in a VITE_ variable, because everything prefixed VITE_ is inlined
 * into the shipped bundle.
 *
 * `.env.production` supplies the production values and is loaded by
 * `vite build --mode production`.
 */

function readEnv(value: string | undefined, fallback: string, name: string): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  const resolved = trimmed.length > 0 ? trimmed : fallback;
  if (resolved.length === 0) {
    // Fail loudly rather than silently pointing the operator at the wrong
    // deployment. In a production build the dev fallback is compiled away, so
    // an empty value here means the build was misconfigured.
    throw new Error(
      `PASS extension: ${name} is not set. Build with the production env loaded ` +
        `(apps/extension/.env.production) or set ${name} explicitly.`,
    );
  }
  return resolved;
}

/**
 * Dev fallbacks are gated on import.meta.env.DEV so Vite folds the branch to
 * `false` in a production build and tree-shakes these strings out of the
 * bundle entirely. No localhost address ships to production.
 */
const DEV_FALLBACKS = import.meta.env.DEV
  ? { api: "http://127.0.0.1:4000", web: "http://localhost:3000" }
  : { api: "", web: "" };

/** Base URL of the PASS API, e.g. https://pass-api-production.up.railway.app */
export const PASS_API_URL: string = readEnv(
  import.meta.env.VITE_PASS_API_URL as string | undefined,
  DEV_FALLBACKS.api,
  "VITE_PASS_API_URL",
);

/** Base URL of the PASS web app, e.g. https://pass-web-dun.vercel.app */
export const PASS_WEB_URL: string = readEnv(
  import.meta.env.VITE_PASS_WEB_URL as string | undefined,
  DEV_FALLBACKS.web,
  "VITE_PASS_WEB_URL",
);

/** Canonical public profile URL (docs/DECISIONS.md D-019.3). */
export function profileUrl(slug: string): string {
  return `${PASS_WEB_URL}/u/${slug}`;
}

/** Authoritative immutable Pass URL. */
export function passUrl(publicId: string): string {
  return `${PASS_WEB_URL}/p/${publicId}`;
}