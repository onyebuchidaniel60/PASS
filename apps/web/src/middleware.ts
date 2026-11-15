import { NextResponse, type NextRequest } from "next/server";

/**
 * Marketing/application split at `/`.
 *
 * `/` is the public marketing page. A visitor who already holds a PASS session
 * belongs in the application at `/app`; without this check, an OAuth return or
 * a saved bookmark would drop a signed-in user back onto marketing.
 *
 * The cookie is checked for PRESENCE only, deliberately. Validating the session
 * here would make the marketing route dynamic and add an API dependency to a
 * page that must stay available when the API is not. A stale cookie is
 * harmless: `/app` resolves the actual identity through `/me` and renders its
 * signed-out state if the session is no longer valid.
 *
 * Keep the cookie name in sync with `apps/api/src/plugins/session.ts`
 * (SESSION_COOKIE = "pass_session"). The X OAuth callback itself is untouched:
 * it still redirects to `/settings?x=connected` or `/onboarding?x=connected`,
 * both of which are application routes.
 */
const SESSION_COOKIE = "pass_session";

export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
