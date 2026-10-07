import type { EthosReputation } from "@pass/contracts";
import { toDecimalString } from "@pass/domain";
import type { EthosPort } from "../ports.js";
import { ProviderUnavailableError } from "../ports.js";

/**
 * Live Ethos adapter.
 *
 * Ethos states its API is public and authenticates with request headers rather
 * than an API key (docs/INTEGRATION_VERIFICATION.md §7). One header is required
 * anyway: `X-Ethos-Client`, which identifies the caller. No secret is involved.
 *
 * ENDPOINTS, VERIFIED 2026-10-07 AGAINST THE LIVE API
 * ---------------------------------------------------
 * The previous version of this file called `/api/v1/reputation/{ref}` and
 * `/api/v1/x/{handle}`. **Neither path exists.** Both return HTTP 404, which
 * `getJson` turned into `null`, so running this adapter in live mode would have
 * rendered "no Ethos data" for EVERY profile — visually identical to a trader
 * genuinely having no reputation, which is the misrepresentation D-007 exists
 * to prevent.
 *
 * What is actually there, read from https://api.ethos.network/docs/openapi.json
 * and confirmed by calling it:
 *
 *   GET /api/v2/user/by/x/{accountIdOrUsername}   -> 200
 *   GET /api/v2/score/userkey?userkey=...         -> 200 {"score":1200,...}
 *
 * The `/user/by/x/` route is used for both port methods because it returns the
 * score AND the review/vouch tallies in one round trip, and because it accepts
 * either form the caller holds: a username ("turnttfup99") or a numeric X id.
 *
 * `ETHOS_API_BASE_URL` should therefore be set to
 * `https://api.ethos.network/api/v2`. v1 is documented as deprecated.
 */
export class LiveEthos implements EthosPort {
  readonly mode = "live" as const;

  /**
   * An upstream that never answers must not hold a PASS request open
   * indefinitely. Ethos is a read-only enrichment source, so timing out is
   * always better than waiting.
   */
  private static readonly TIMEOUT_MS = 5_000;

  constructor(private readonly baseUrl: string) {}

  private async getJson<T>(path: string): Promise<T | null> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          // Required by Ethos. Not a credential — it names the calling app.
          "X-Ethos-Client": "pass",
        },
        signal: AbortSignal.timeout(LiveEthos.TIMEOUT_MS),
      });
    } catch (err) {
      // Timeout, DNS failure, TLS error. All are "we could not ask", which is
      // NOT the same as "this trader has no reputation", so it is raised rather
      // than swallowed into a null.
      throw new ProviderUnavailableError("ethos", String(err));
    }

    // A genuine miss is a clean not-found: this handle has no Ethos profile.
    if (res.status === 404) return null;
    // Anything else non-2xx is an upstream fault. Returning null here would
    // report "no reputation" when the truth is "Ethos is down".
    if (!res.ok) {
      throw new ProviderUnavailableError("ethos", `ethos responded ${res.status}`);
    }

    const body = (await res.json()) as { data?: unknown } & Record<string, unknown>;
    // Ethos wraps some routes in `{ok, data}`. Accept either shape rather than
    // returning an object whose fields are all undefined.
    if (body && typeof body === "object" && body.data && typeof body.data === "object") {
      return body.data as T;
    }
    return body as T;
  }

  /**
   * Reputation is read-only and cached by the caller. PASS never writes to
   * Ethos and never treats the score as a verdict (D-007).
   *
   * `profileRef` is whatever the caller holds for the linked X identity: a
   * username or a numeric account id. `/user/by/x/` accepts both.
   */
  async getReputation(profileRef: string): Promise<EthosReputation | null> {
    const raw = await this.getJson<Record<string, unknown>>(
      `/user/by/x/${encodeURIComponent(profileRef)}`,
    );
    if (!raw) return null;

    const num = (v: unknown): number | null => {
      if (v === undefined || v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return {
      providerProfileId: LiveEthos.idOf(raw),
      credibilityScore: num(raw.score),
      reviewsCount: LiveEthos.reviewTotal(raw),
      vouchesCount: LiveEthos.vouchTotal(raw),
      humanVerified: LiveEthos.humanVerified(raw),
      sourceUrl:
        typeof (raw.links as Record<string, unknown> | undefined)?.profile ===
        "string"
          ? ((raw.links as Record<string, unknown>).profile as string)
          : typeof raw.url === "string"
            ? raw.url
            : null,
      syncedAt: new Date().toISOString(),
    };
  }

  async identityFromXHandle(handle: string): Promise<string | null> {
    const raw = await this.getJson<Record<string, unknown>>(
      `/user/by/x/${encodeURIComponent(handle)}`,
    );
    return raw ? LiveEthos.idOf(raw) : null;
  }

  /**
   * The stable Ethos id.
   *
   * `profileId` is present but NULL for X-attested profiles — which is every
   * profile this adapter will see in practice — so it cannot be the primary key
   * here. `id` is always populated and is what the docs use for identity.
   */
  private static idOf(raw: Record<string, unknown>): string | null {
    if (typeof raw.profileId === "string" && raw.profileId) return raw.profileId;
    if (typeof raw.profileId === "number") return String(raw.profileId);
    if (typeof raw.id === "string" && raw.id) return raw.id;
    if (typeof raw.id === "number" && Number.isFinite(raw.id)) return String(raw.id);
    return null;
  }

  /**
   * Reviews received, as a total.
   *
   * Ethos reports the split (positive / neutral / negative) rather than a
   * count, so the total is the sum. Reporting the sum is also the honest
   * reading of "reviewsCount": it does not launder a 1-positive-9-negative
   * history into a bare "9 reviews" that reads as social proof.
   */
  private static reviewTotal(raw: Record<string, unknown>): number | null {
    const stats = raw.stats as Record<string, unknown> | undefined;
    const review = stats?.review as Record<string, unknown> | undefined;
    const received = review?.received as Record<string, unknown> | undefined;
    if (!received) return null;
    const parts = ["positive", "neutral", "negative"].map((k) => {
      const v = Number(received[k]);
      return Number.isFinite(v) ? v : 0;
    });
    if (parts.every((n) => n === 0) && received.positive === undefined) return null;
    return parts.reduce((a, b) => a + b, 0);
  }

  private static vouchTotal(raw: Record<string, unknown>): number | null {
    const stats = raw.stats as Record<string, unknown> | undefined;
    const vouch = stats?.vouch as Record<string, unknown> | undefined;
    const received = vouch?.received as Record<string, unknown> | undefined;
    if (received === undefined || received === null) return null;
    const count = Number(received.count);
    return Number.isFinite(count) ? count : null;
  }

  /**
   * `humanVerificationStatus` is a string enum or null. Anything that reads as
   * verified is mapped to true; anything else present-but-not-verified to
   * false; absent to null, which is different from "not verified" (D-007).
   */
  private static humanVerified(raw: Record<string, unknown>): boolean | null {
    const status = raw.humanVerificationStatus;
    if (status === undefined || status === null) return null;
    if (typeof status === "boolean") return status;
    if (typeof status !== "string") return null;
    const s = status.toUpperCase();
    if (s === "VERIFIED" || s === "HUMAN_VERIFIED") return true;
    if (s === "UNVERIFIED" || s === "PENDING" || s === "REJECTED") return false;
    return null;
  }

  static snapshotToDecimal(score: number | null): string | null {
    return score === null ? null : toDecimalString(score);
  }
}