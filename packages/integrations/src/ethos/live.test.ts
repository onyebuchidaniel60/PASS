import { afterEach, describe, expect, it, vi } from "vitest";

import { LiveEthos } from "./live.js";

/**
 * LiveEthos, pinned to the endpoints that actually exist.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The previous adapter called `/api/v1/reputation/{ref}` and `/api/v1/x/{handle}`.
 * Both return HTTP 404 on the real API — verified 2026-10-07 — and `getJson`
 * turned 404 into `null`. So flipping `ETHOS_MODE=live` would have rendered
 * "no Ethos data" for every profile in production, which is visually identical
 * to a trader genuinely having no reputation. That is precisely the
 * misrepresentation D-007 and PRD §12 exist to prevent, and no type check,
 * lint, or unit test would ever have caught it: the old code typechecked
 * perfectly against paths that do not exist.
 *
 * These assertions are therefore about the REQUEST, not the response mapping
 * alone. A path regression has to fail here.
 *
 * Recorded live responses, captured from api.ethos.network on 2026-10-07:
 *   GET /api/v2/user/by/x/turnttfup99 -> 200
 *   GET /api/v2/score/userkey?userkey=... -> 200 {"score":1200,"level":"neutral"}
 *   GET /api/v1/reputation/turnttfup99 -> 404   (the old path)
 *   GET /api/v1/x/turnttfup99         -> 404   (the old path)
 */
const BASE = "https://api.ethos.network/api/v2";

/** A real response body, trimmed of fields this adapter does not read. */
const USER_BY_X = {
  id: 5886741,
  profileId: null,
  displayName: "turntt",
  username: "Turnttfup99",
  avatarUrl: "https://pbs.twimg.com/profile_images/2072955315792797696/Rx2fPMph.jpg",
  score: 1200,
  status: "INACTIVE",
  userkeys: ["service:x.com:1749142833355804672"],
  humanVerificationStatus: null,
  links: { profile: "https://app.ethos.network/profile/x/Turnttfup99" },
  stats: {
    review: { received: { negative: 0, neutral: 0, positive: 0 } },
    vouch: {
      given: { amountWeiTotal: "0", count: 0 },
      received: { amountWeiTotal: "0", count: 0 },
    },
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LiveEthos requests the endpoints that exist", () => {
  it("calls the v2 user-by-x route, not the 404 v1 path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(USER_BY_X));
    vi.stubGlobal("fetch", fetchMock);

    await new LiveEthos(BASE).getReputation("turnttfup99");

    const url = String((fetchMock.mock.calls[0]?.[0] ?? ""));
    expect(url).toBe(`${BASE}/user/by/x/turnttfup99`);
    // The specific thing that broke: these two paths are 404 on the real API.
    expect(url).not.toContain("/api/v1/reputation");
    expect(url).not.toContain("/api/v1/x/");
  });

  it("sends the X-Ethos-Client header the API requires", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(USER_BY_X));
    vi.stubGlobal("fetch", fetchMock);

    await new LiveEthos(BASE).getReputation("turnttfup99");

    const init = (fetchMock.mock.calls[0]?.[1] as RequestInit ?? {}) as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Ethos-Client"]).toBeTruthy();
  });

  it("url-encodes the reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(USER_BY_X));
    vi.stubGlobal("fetch", fetchMock);

    await new LiveEthos(BASE).getReputation("a/b?c");

    expect(String((fetchMock.mock.calls[0]?.[0] ?? ""))).toContain("a%2Fb%3Fc");
  });

  it("tolerates a trailing slash on the configured base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(USER_BY_X));
    vi.stubGlobal("fetch", fetchMock);

    await new LiveEthos(`${BASE}/`).getReputation("turnttfup99");

    expect(String((fetchMock.mock.calls[0]?.[0] ?? ""))).toBe(`${BASE}/user/by/x/turnttfup99`);
  });
});

describe("LiveEthos maps the real response shape", () => {
  it("reads the score, the tallies and the profile link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(USER_BY_X)));

    const rep = await new LiveEthos(BASE).getReputation("turnttfup99");

    expect(rep).not.toBeNull();
    expect(rep?.credibilityScore).toBe(1200);
    expect(rep?.reviewsCount).toBe(0);
    expect(rep?.vouchesCount).toBe(0);
    expect(rep?.sourceUrl).toBe("https://app.ethos.network/profile/x/Turnttfup99");
  });

  it("uses id, not the null profileId, as the provider identity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(USER_BY_X)));

    const rep = await new LiveEthos(BASE).getReputation("turnttfup99");

    // `profileId` is null for every X-attested profile, which is all this
    // adapter ever sees. Keying on it would have written null for everyone.
    expect(rep?.providerProfileId).toBe("5886741");
  });

  it("sums the positive, neutral and negative review split", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...USER_BY_X,
          stats: {
            ...USER_BY_X.stats,
            review: { received: { negative: 2, neutral: 1, positive: 7 } },
          },
        }),
      ),
    );

    const rep = await new LiveEthos(BASE).getReputation("turnttfup99");

    expect(rep?.reviewsCount).toBe(10);
  });

  it("reads vouch count from stats.vouch.received", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...USER_BY_X,
          stats: {
            ...USER_BY_X.stats,
            vouch: { received: { amountWeiTotal: "0", count: 5 } },
          },
        }),
      ),
    );

    expect((await new LiveEthos(BASE).getReputation("x"))?.vouchesCount).toBe(5);
  });

  it("unwraps an ok/data envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: USER_BY_X })),
    );

    expect((await new LiveEthos(BASE).getReputation("x"))?.credibilityScore).toBe(
      1200,
    );
  });

  it("maps human verification without inventing a verdict", async () => {
    const withStatus = (status: unknown) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse({ ...USER_BY_X, humanVerificationStatus: status }),
        ),
      );
    };
    const ethos = new LiveEthos(BASE);

    withStatus("VERIFIED");
    expect((await ethos.getReputation("x"))?.humanVerified).toBe(true);

    withStatus("PENDING");
    expect((await ethos.getReputation("x"))?.humanVerified).toBe(false);

    withStatus(null);
    // Absent is not the same as "not verified" (D-007).
    expect((await ethos.getReputation("x"))?.humanVerified).toBeNull();
  });
});

describe("LiveEthos distinguishes three outcomes, not two", () => {
  it("returns null on a real 404 — a handle with no Ethos profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "NOT_FOUND" }, 404)),
    );

    // The behaviour the brief asks for explicitly: a clean not-found.
    expect(await new LiveEthos(BASE).getReputation("nobody")).toBeNull();
  });

  it("THROWS on a 5xx rather than reporting no reputation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "boom" }, 503)),
    );

    // The old adapter returned null for every non-ok status, which reported an
    // outage as "this trader has no reputation".
    await expect(new LiveEthos(BASE).getReputation("x")).rejects.toThrow();
  });

  it("throws when the network itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(new LiveEthos(BASE).getReputation("x")).rejects.toThrow();
  });

  it("resolves the Ethos identity from an X handle", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(USER_BY_X));
    vi.stubGlobal("fetch", fetchMock);

    expect(await new LiveEthos(BASE).identityFromXHandle("turnttfup99")).toBe(
      "5886741",
    );
    expect(String((fetchMock.mock.calls[0]?.[0] ?? ""))).toContain("/user/by/x/");
  });
});