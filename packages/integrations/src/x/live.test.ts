import { describe, expect, it, vi, afterEach } from "vitest";

import { LiveX } from "./live.js";

/**
 * `getAuthenticatedUser` — the step that failed in production.
 *
 * The callback used to call `/2/users/me` inline and, on any non-2xx, throw a
 * bare `IDENTITY_NOT_CONNECTED: Could not resolve the X profile`, discarding X's
 * status and body. A 401 (bad token) and a 403 (missing `users.read`) were
 * indistinguishable. These tests pin the endpoint, the token, and the
 * diagnosability — and above all that redaction cannot leak a credential,
 * because the whole point is to echo X's body back to the operator.
 */

const TOKEN = "AAAAAAAAAAAAAAAAAAAA-very-long-opaque-user-access-token-value-0123456789";

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const OK = {
  data: {
    id: "1749142833355804672",
    username: "Turnttfup99",
    name: "turntt",
    profile_image_url: "https://pbs.twimg.com/profile_images/1.jpg",
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("getAuthenticatedUser endpoint and credentials", () => {
  it("calls /2/users/me, not /2/users/by/username", async () => {
    const fetchMock = stubFetch(OK);
    await new LiveX().getAuthenticatedUser(TOKEN);

    const url = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/2/users/me");
    // There is no handle after a token exchange, so a by-username lookup is not
    // merely unnecessary, it is impossible.
    expect(url).not.toContain("by/username");
  });

  it("sends the USER access token as Bearer", async () => {
    const fetchMock = stubFetch(OK);
    await new LiveX().getAuthenticatedUser(TOKEN);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("maps the response to the XUser shape", async () => {
    stubFetch(OK);
    const user = await new LiveX().getAuthenticatedUser(TOKEN);
    expect(user).toEqual({
      xUserId: "1749142833355804672",
      handle: "Turnttfup99",
      displayName: "turntt",
      avatarUrl: "https://pbs.twimg.com/profile_images/1.jpg",
    });
  });

  it("tolerates a profile with no display name or avatar", async () => {
    stubFetch({ data: { id: "1", username: "u" } });
    expect(await new LiveX().getAuthenticatedUser(TOKEN)).toEqual({
      xUserId: "1",
      handle: "u",
      displayName: null,
      avatarUrl: null,
    });
  });

  it("refuses to call X with no token", async () => {
    const fetchMock = stubFetch(OK);
    await expect(new LiveX().getAuthenticatedUser("")).rejects.toThrow(/no x access token/i);
    // No token means no request, rather than `Authorization: Bearer ` and a
    // pointless 401.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getAuthenticatedUser is diagnosable", () => {
  it("reports the HTTP status, so 401 and 403 are distinguishable", async () => {
    stubFetch({ detail: "Unauthorized" }, 401);
    await expect(new LiveX().getAuthenticatedUser(TOKEN)).rejects.toThrow(/401/);
  });

  it("surfaces X's own error text", async () => {
    stubFetch({ detail: "You are not permitted to perform this action." }, 403);
    await expect(new LiveX().getAuthenticatedUser(TOKEN)).rejects.toThrow(
      /not permitted/i,
    );
  });

  it("reports a 200 with no profile data instead of returning a blank user", async () => {
    stubFetch({ errors: [{ message: "nothing here" }] });
    await expect(new LiveX().getAuthenticatedUser(TOKEN)).rejects.toThrow(
      /no profile data/i,
    );
  });

  it("marks 429 and 5xx retryable, and 4xx not", async () => {
    stubFetch({ d: "slow down" }, 429);
    await expect(new LiveX().getAuthenticatedUser(TOKEN)).rejects.toMatchObject({
      retryable: true,
    });

    stubFetch({ d: "nope" }, 403);
    await expect(new LiveX().getAuthenticatedUser(TOKEN)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("raises an unavailable error when X cannot be reached at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    await expect(new LiveX().getAuthenticatedUser(TOKEN)).rejects.toThrow();
  });
});

describe("getAuthenticatedUser never leaks a credential in its errors", () => {
  it("redacts the bearer token if X echoes it back", async () => {
    stubFetch({ detail: `bad token: Bearer ${TOKEN}` }, 401);
    const err = (await new LiveX().getAuthenticatedUser(TOKEN).catch((e) => e)) as Error;
    expect(err.message).not.toContain(TOKEN);
    expect(err.message).toContain("[redacted]");
  });

  it("redacts an access_token field in an error body", async () => {
    stubFetch({ detail: "bad", access_token: TOKEN }, 401);
    const err = (await new LiveX().getAuthenticatedUser(TOKEN).catch((e) => e)) as Error;
    expect(err.message).not.toContain(TOKEN);
  });

  it("redacts any other long opaque credential-shaped string", async () => {
    const secret = "z".repeat(64);
    stubFetch({ detail: `credential ${secret}` }, 403);
    const err = (await new LiveX().getAuthenticatedUser(TOKEN).catch((e) => e)) as Error;
    expect(err.message).not.toContain(secret);
  });

  it("truncates a very long body so the error stays readable", async () => {
    stubFetch({ detail: "x".repeat(5000) }, 400);
    const err = (await new LiveX().getAuthenticatedUser(TOKEN).catch((e) => e)) as Error;
    expect(err.message.length).toBeLessThan(500);
  });

  it("still keeps the status and a useful summary after redacting", async () => {
    // Redaction must not make the error useless.
    stubFetch({ detail: `token Bearer ${TOKEN} rejected` }, 401);
    const err = (await new LiveX().getAuthenticatedUser(TOKEN).catch((e) => e)) as Error;
    expect(err.message).toMatch(/401/);
    expect(err.message).toMatch(/rejected/);
  });
});