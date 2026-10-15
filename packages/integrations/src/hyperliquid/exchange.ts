import type {
  HLOrderStatus,
  HLRelayResult,
  SignedPayload,
} from "@pass/contracts";
import { ProviderError, ProviderUnavailableError } from "../ports.js";
import { type HyperliquidInfoClient } from "./info.js";

/**
 * Hyperliquid Exchange API relay.
 * Reference: https://hyperliquid.gitbook.io/Hyperliquid-docs/for-developers/api/exchange-endpoint
 *
 * This client only ever forwards an already-signed payload. It holds no
 * private key, no API wallet secret, and no signing material of any kind
 * (docs/DECISIONS.md D-018.3, D-018.9).
 */
/**
 * Extracts the order id from a Hyperliquid Exchange order response.
 *
 * Real responses nest it at `response.data.statuses[0].resting.oid`
 * (resting order) or `response.data.statuses[0].filled.oid` (immediate
 * fill) — never at the top-level `response.data.oid` the previous code
 * read. The legacy shapes survive only as last resorts. Returns null when
 * no parseable oid exists anywhere, so the caller can throw a distinct
 * error instead of an empty id.
 */
function extractOrderOid(
  parsed: unknown,
  response: Record<string, unknown>,
): string | null {
  const asOid = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.length > 0) return value;
    return null;
  };
  const data =
    response.data && typeof response.data === "object"
      ? (response.data as Record<string, unknown>)
      : null;
  const statuses = data?.statuses;
  const first =
    Array.isArray(statuses) && statuses.length > 0 ? statuses[0] : null;
  if (first && typeof first === "object") {
    const entry = first as Record<string, unknown>;
    const resting =
      entry.resting && typeof entry.resting === "object"
        ? (entry.resting as Record<string, unknown>)
        : null;
    const filled =
      entry.filled && typeof entry.filled === "object"
        ? (entry.filled as Record<string, unknown>)
        : null;
    return (
      asOid(resting?.oid) ??
      asOid(filled?.oid) ??
      asOid(data?.oid) ??
      (typeof parsed === "object" && parsed !== null && "oid" in parsed
        ? asOid((parsed as Record<string, unknown>).oid)
        : null)
    );
  }
  return (
    asOid(data?.oid) ??
    (typeof parsed === "object" && parsed !== null && "oid" in parsed
      ? asOid((parsed as Record<string, unknown>).oid)
      : null)
  );
}

export class HyperliquidExchangeClient {
  constructor(
    private readonly exchangeUrl: string,
    private readonly info: HyperliquidInfoClient,
  ) {}

  async relaySignedAction(signed: SignedPayload): Promise<HLRelayResult> {
    const body = {
      ...signed.exchangeRequest,
      signature: signed.signature,
    };

    let res: Response;
    try {
      res = await fetch(this.exchangeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ProviderUnavailableError("hyperliquid", String(err));
    }

    const text = await res.text();

    if (res.status === 429) {
      throw new ProviderError("Hyperliquid rate limited the request", "hyperliquid", true);
    }

    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      throw new ProviderError(
        `Hyperliquid Exchange API ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
        "hyperliquid",
        res.status >= 500,
      );
    }

    // The Exchange API answers with {status: "ok"|"err", response: ...}.
    const body_ = parsed as { status?: string; response?: unknown } | null;
    if (body_?.status === "err") {
      throw new ProviderError(
        `Hyperliquid rejected the order: ${JSON.stringify(body_.response ?? {})}`,
        "hyperliquid",
        false,
      );
    }

    const response = (body_?.response ?? {}) as Record<string, unknown>;
    // Hyperliquid answers 200 with `statuses[0].error` for rejected orders
    // (e.g. sub-$10: "Order must have minimum value of $10. asset=0").
    // That is a rejection WITH a reason, not a parse gap: surface the
    // venue's message verbatim, non-retryable, with the raw response kept
    // in details. Only a resting/filled shape with no oid may fall through
    // to the "could not read the order id" parse failure below.
    const statuses = (response.data as Record<string, unknown> | undefined)?.statuses;
    const firstStatus =
      Array.isArray(statuses) && statuses.length > 0 ? statuses[0] : null;
    if (
      firstStatus !== null &&
      typeof firstStatus === "object" &&
      "error" in firstStatus &&
      typeof (firstStatus as Record<string, unknown>).error === "string" &&
      ((firstStatus as Record<string, unknown>).error as string).length > 0
    ) {
      throw new ProviderError(
        (firstStatus as Record<string, unknown>).error as string,
        "hyperliquid",
        false,
        { raw: parsed },
      );
    }
    const providerOrderId = extractOrderOid(parsed, response);
    if (providerOrderId === null) {
      // status "ok" (or another non-"err" status) but no parseable oid:
      // the exchange answered without an id PASS understands. Throw a
      // distinct error carrying the full raw response for diagnosis — never
      // an empty id, which relayExecution would mislabel as "relay
      // disabled" (a mode problem, which this is not).
      throw new ProviderError(
        `Hyperliquid accepted the order but PASS could not read the order id: ${JSON.stringify(parsed).slice(0, 1000)}`,
        "hyperliquid",
        false,
      );
    }

    return {
      providerOrderId,
      status: "open",
      rawStatus: parsed,
      simulated: false,
    };
  }

  /**
   * Relays a client-signed approveAgent action (D-019.1). Only the signature
   * and the agent address are sent; no key material is present.
   */
  async relayApproveAgent(params: {
    agentAddress: string;
    nonce: number;
    signature: Record<string, unknown>;
    hyperliquidChain?: string;
  }): Promise<{ ok: boolean; raw?: unknown }> {
    // The venue label AND the signature chain id both follow the venue:
    // testnet signs 0x66eee/"Testnet" (Arbitrum Sepolia), mainnet signs
    // 0xa4b1/"Mainnet". A Mainnet-labelled approval on testnet is rejected
    // or misfiled, and it must match the label the client signed.
    // agentName is always present ("" = unnamed agent), exactly as the
    // official SDK posts it.
    const testnet = params.hyperliquidChain === "Testnet";
    const action = {
      type: "approveAgent",
      hyperliquidChain: params.hyperliquidChain ?? "Mainnet",
      signatureChainId: testnet ? "0x66eee" : "0xa4b1",
      agentAddress: params.agentAddress,
      agentName: "",
      nonce: params.nonce,
    };

    let res: Response;
    try {
      res = await fetch(this.exchangeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          nonce: params.nonce,
          signature: params.signature,
        }),
      });
    } catch (err) {
      throw new ProviderUnavailableError("hyperliquid", String(err));
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      throw new ProviderError(
        `Hyperliquid Exchange API ${res.status}: ${text.slice(0, 200)}`,
        "hyperliquid",
        res.status >= 500,
      );
    }

    const body = parsed as { status?: string; response?: unknown } | null;
    if (body?.status === "err") {
      // Includes "Unable to recover signer" for an invalid signature.
      throw new ProviderError(
        `Hyperliquid rejected the agent approval: ${JSON.stringify(body.response ?? {})}`,
        "hyperliquid",
        false,
      );
    }

    return { ok: true, raw: parsed };
  }

  async getOrderStatus(providerOrderId: string): Promise<HLOrderStatus | null> {
    const oid = Number(providerOrderId);
    if (!Number.isFinite(oid)) return null;
    return this.info.orderStatusByOid(oid);
  }
}