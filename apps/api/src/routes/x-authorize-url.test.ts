import { describe, expect, it } from "vitest";

import { LiveX } from "@pass/integrations";

/**
 * The X OAuth authorize URL.
 *
 * These assertions exist because the flow was unreachable and nothing caught
 * it. `/api/v1/auth/x/start` called `requireUser()`, so it answered
 * AUTH_REQUIRED to exactly the users it exists for — a brand-new visitor with
 * no PASS session. No test covered reachability, so the bug shipped.
 */

const base = {
  clientId: "CLIENT123",
  redirectUri: "https://pass-api-production.up.railway.app/api/v1/auth/x/callback",
  state: "state-token",
  codeChallenge: "challenge-value",
  scope: "tweet.read tweet.write users.read offline.access",
};

function parsed(url: string): URL {
  return new URL(url);
}

describe("LiveX.buildAuthorizationUrl", () => {
  it("authorizes on x.com, not the legacy twitter.com host", () => {
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
  });

  it("sends response_type=code", () => {
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("sends the client_id", () => {
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    expect(url.searchParams.get("client_id")).toBe("CLIENT123");
  });

  it("sends the redirect_uri VERBATIM, byte for byte", () => {
    // X requires an exact match against the Developer Console allowlist and
    // answers "Callback URL not approved" otherwise. Any normalisation here —
    // a trailing slash, a re-encoded path — breaks the flow.
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    expect(url.searchParams.get("redirect_uri")).toBe(base.redirectUri);
  });

  it("sends the requested scopes", () => {
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    expect(url.searchParams.get("scope")).toBe(
      "tweet.read tweet.write users.read offline.access",
    );
  });

  it("sends state, which is the only CSRF protection on the callback", () => {
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    expect(url.searchParams.get("state")).toBe("state-token");
  });

  it("sends the PKCE code_challenge with method S256", () => {
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("never puts the client secret in the authorize URL", () => {
    // The authorize URL is not passed here at all, but assert the shape so a
    // future signature change cannot quietly start including one: URLs leak
    // through browser history, proxies and the referrer chain.
    const url = new LiveX().buildAuthorizationUrl(base);
    expect(url).not.toContain("client_secret");
    expect(new URL(url).searchParams.get("client_secret")).toBeNull();
  });

  it("includes every parameter X requires, and nothing extra", () => {
    const url = parsed(new LiveX().buildAuthorizationUrl(base));
    const keys = [...url.searchParams.keys()].sort();
    expect(keys).toEqual([
      "client_id",
      "code_challenge",
      "code_challenge_method",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
    ]);
  });

  it("url-encodes the redirect_uri so its slashes survive as parameters", () => {
    const url = new LiveX().buildAuthorizationUrl(base);
    expect(url).toContain(encodeURIComponent(base.redirectUri));
  });
});