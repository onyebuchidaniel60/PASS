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
    const data = response.data as Record<string, unknown> | undefined;
    const providerOrderId =
      (data?.oid !== undefined ? String(data.oid) : null) ??
      (typeof parsed === "object" && parsed !== null && "oid" in parsed
        ? String((parsed as Record<string, unknown>).oid)
        : null);

    return {
      providerOrderId: providerOrderId ?? "",
      status: "open",
      rawStatus: parsed,
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
  }): Promise<{ ok: boolean; raw?: unknown }> {
    const action = {
      type: "approveAgent",
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
      agentAddress: params.agentAddress,
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