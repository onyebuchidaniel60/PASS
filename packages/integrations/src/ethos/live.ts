import type { EthosReputation } from "@pass/contracts";
import { toDecimalString } from "@pass/domain";
import type { EthosPort } from "../ports.js";
import { ProviderUnavailableError } from "../ports.js";

/**
 * Live Ethos adapter.
 *
 * Ethos states its API is public and authenticates with request headers rather
 * than an API key (docs/INTEGRATION_VERIFICATION.md §7). Only a base URL is
 * required; no secret is involved.
 */
export class LiveEthos implements EthosPort {
  readonly mode = "live" as const;

  constructor(private readonly baseUrl: string) {}

  private async getJson<T>(path: string): Promise<T | null> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch (err) {
      throw new ProviderUnavailableError("ethos", String(err));
    }
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  }

  /**
   * Reputation is read-only and cached by the caller. PASS never writes to
   * Ethos and never treats the score as a verdict (D-007).
   */
  async getReputation(profileRef: string): Promise<EthosReputation | null> {
    const raw = await this.getJson<Record<string, unknown>>(
      `/api/v1/reputation/${encodeURIComponent(profileRef)}`,
    );
    if (!raw) return null;
    const num = (v: unknown): number | null => {
      if (v === undefined || v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      providerProfileId:
        typeof raw.profileId === "string" ? raw.profileId : (raw.id as string) ?? null,
      credibilityScore: num(raw.credibilityScore),
      reviewsCount: num(raw.reviewsCount),
      vouchesCount: num(raw.vouchesCount),
      humanVerified:
        typeof raw.isHumanVerified === "boolean" ? raw.isHumanVerified : null,
      sourceUrl: typeof raw.url === "string" ? raw.url : null,
      syncedAt: new Date().toISOString(),
    };
  }

  async identityFromXHandle(handle: string): Promise<string | null> {
    const raw = await this.getJson<Record<string, unknown>>(
      `/api/v1/x/${encodeURIComponent(handle)}`,
    );
    if (!raw) return null;
    return typeof raw.profileId === "string" ? raw.profileId : null;
  }

  static snapshotToDecimal(score: number | null): string | null {
    return score === null ? null : toDecimalString(score);
  }
}