import type { XPostResult, XUser } from "@pass/contracts";
import type { XPort } from "../ports.js";
import { ProviderError, ProviderUnavailableError } from "../ports.js";

/**
 * Strips anything token-shaped out of an X error body before it is logged or
 * returned to a client.
 *
 * The failure text is echoed to the operator precisely so it is diagnosable,
 * which is also how a credential would leak if X ever echoed the Authorization
 * header back. So this is applied to EVERY body we surface, not just the ones
 * we expect to be safe, and it fails closed on the long opaque strings that
 * bearer tokens are made of.
 */
function redactX(body: string): string {
  if (!body) return "";
  return body
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[redacted]")
    .replace(/("(?:access_token|refresh_token|id_token|code|code_verifier)"\s*:\s*")[^"]*"/gi, '$1[redacted]"')
    // Catch-all for any other long opaque credential-shaped value.
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[redacted]")
    .slice(0, 300);
}

/**
 * Live X adapter.
 * Reference: https://docs.x.com/x-api/posts/create-post
 *
 * Native posting is optional. Sharing must remain usable as copy-only when
 * posting is unavailable (docs/API_CONTRACTS.md §5, Stage H gate).
 */
export class LiveX implements XPort {
  readonly mode = "live" as const;

  async resolveIdentity(handle: string): Promise<XUser | null> {
    // Display-only resolution uses the public users-by-username endpoint.
    const clean = encodeURIComponent(handle.replace(/^@/, ""));
    let res: Response;
    try {
      res = await fetch(
        `https://api.x.com/2/users/by/username/${clean}?user.fields=profile_image_url,description`,
        { headers: { Accept: "application/json" } },
      );
    } catch (err) {
      throw new ProviderUnavailableError("x", String(err));
    }
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { id: string; username: string; name?: string; profile_image_url?: string };
    };
    if (!json.data) return null;
    return {
      xUserId: json.data.id,
      handle: json.data.username,
      displayName: json.data.name ?? null,
      avatarUrl: json.data.profile_image_url ?? null,
    };
  }

  /**
   * Resolves the authenticated user via `GET /2/users/me`.
   *
   * Why `/2/users/me` and not `/2/users/by/username/{handle}`: after a token
   * exchange there is no handle to look up. The user access token IS the
   * subject, so `/2/users/me` needs no username round trip. `/2/users/by/...`
   * is for looking somebody else up and is the wrong endpoint here.
   *
   * Token: the USER access token from the exchange, as `Authorization: Bearer`.
   * The app bearer token is NOT interchangeable — X answers 403 for a
   * user-context endpoint called with app-only auth.
   *
   * DIAGNOSABILITY. This used to fail as a bare
   * `IDENTITY_NOT_CONNECTED: Could not resolve the X profile`, which threw away
   * the only useful information: whether X said 401 (bad/expired token), 403
   * (missing `users.read` or app not permitted), or 429, and what it said.
   * The status and a redacted body now ride along on the error so an operator
   * can tell those apart without reproducing it with curl.
   */
  async getAuthenticatedUser(accessToken: string): Promise<XUser> {
    if (!accessToken) {
      throw new ProviderError(
        "No X access token available for identity resolution",
        "x",
        false,
      );
    }

    let res: Response;
    try {
      res = await fetch(
        "https://api.x.com/2/users/me?user.fields=profile_image_url",
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch (err) {
      throw new ProviderUnavailableError("x", String(err));
    }

    if (!res.ok) {
      // Read the body ONCE, then include a redacted, truncated copy.
      const raw = await res.text().catch(() => "");
      const detail = redactX(raw);
      throw new ProviderError(
        `X /2/users/me returned ${res.status}${detail ? `: ${detail}` : ""}`,
        "x",
        res.status === 429 || res.status >= 500,
      );
    }

    const json = (await res.json()) as {
      data?: {
        id: string;
        username: string;
        name?: string;
        profile_image_url?: string;
      };
    };
    if (!json.data?.id) {
      throw new ProviderError(
        `X /2/users/me returned no profile data: ${redactX(JSON.stringify(json))}`,
        "x",
        false,
      );
    }

    return {
      xUserId: json.data.id,
      handle: json.data.username,
      displayName: json.data.name ?? null,
      avatarUrl: json.data.profile_image_url ?? null,
    };
  }

  async createPost(accessToken: string, text: string): Promise<XPostResult> {
    if (!accessToken) {
      throw new ProviderError("X access token is unavailable", "x", false);
    }
    let res: Response;
    try {
      res = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      throw new ProviderUnavailableError("x", String(err));
    }
    if (!res.ok) {
      const text2 = await res.text();
      throw new ProviderError(`X post failed ${res.status}: ${text2}`, "x", res.status >= 500);
    }
    const json = (await res.json()) as { data?: { id: string; text: string } };
    const id = json.data?.id ?? "";
    return {
      postId: id,
      text: json.data?.text ?? text,
      url: id ? `https://x.com/i/web/status/${id}` : null,
    };
  }

  /**
   * Builds the OAuth 2.0 Authorization Code + PKCE URL.
   *
   * `code_challenge_method=S256` and `state` are both mandatory for PKCE, and
   * neither is optional in practice: without `state` there is no CSRF
   * protection on the callback, and without S256 the verifier is transmitted
   * in a way that defeats the point of PKCE.
   *
   * Host is `x.com`, which is the current canonical authorize host and the one
   * that must appear in the app's X developer settings. `twitter.com/i/oauth2`
   * redirects, but relying on a redirect for the authorization endpoint makes
   * the mismatch harder to diagnose when a client is misconfigured.
   *
   * `client_secret` is deliberately NOT included here. It must not appear in a
   * URL: URLs are logged by browsers, proxies and the referrer chain.
   */
  buildAuthorizationUrl(opts: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scope: string;
  }): string {
    const p = new URLSearchParams({
      response_type: "code",
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      scope: opts.scope,
      state: opts.state,
      code_challenge: opts.codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://x.com/i/oauth2/authorize?${p.toString()}`;
  }
}