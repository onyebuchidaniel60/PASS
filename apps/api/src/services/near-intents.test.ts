import { describe, expect, it, vi } from "vitest";
import type { ApiEnv } from "@pass/contracts";
import { loadEnv } from "../env.js";
import {
  quoteNearIntents,
  toAtomicAmount,
} from "./near-intents.js";

function liveEnv(): ApiEnv {
  return {
    ...loadEnv({}),
    NEAR_INTENTS_MODE: "live",
    NEAR_INTENTS_API_URL: "https://1click.test",
    NEAR_INTENTS_JWT: "test-jwt",
  };
}

describe("NEAR Intents quote", () => {
  it("converts decimal amounts without floating-point rounding", () => {
    expect(toAtomicAmount("100", 6)).toBe("100000000");
    expect(toAtomicAmount("0.000001", 6)).toBe("1");
    expect(toAtomicAmount("1.5", 8)).toBe("150000000");
    expect(() => toAtomicAmount("0", 6)).toThrow(/greater than zero/);
    expect(() => toAtomicAmount("1.0000001", 6)).toThrow(/decimal places/);
  });

  it("returns a confidential mock quote without a network call", async () => {
    const fetchMock = vi.fn();
    const result = await quoteNearIntents(
      loadEnv({}),
      {
        sourceChain: "ethereum",
        sourceToken: "USDC",
        destinationAddress: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "100",
        isConfidential: true,
      },
      fetchMock,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.mode).toBe("mock");
    expect(result.confidentiality).toBe("basic");
    expect(result.depositAddress).toMatch(/^0x[0-9a-f]{40}$/);
    expect(result.source.amountAtomic).toBe("100000000");
    expect(result.destination.chain).toBe("hypercore");
    expect(result.transactionPayload.to).toBe(result.depositAddress);
  });

  it("sends confidentiality and the JWT on a live confidential quote", async () => {
    let requestBody: Record<string, unknown> | null = null;
    let authorization: string | null = null;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      authorization = new Headers(init?.headers).get("Authorization");
      return new Response(
        JSON.stringify({
          quote: {
            amountIn: "250000000",
            amountInFormatted: "250.0",
            amountOut: "249000000",
            minAmountOut: "248000000",
            deadline: new Date(Date.now() + 600_000).toISOString(),
            depositAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          },
          signature: "sig-test",
          quoteRequest: { confidentiality: "basic" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await quoteNearIntents(
      liveEnv(),
      {
        sourceChain: "solana",
        sourceToken: "USDC",
        destinationAddress: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "250",
        isConfidential: true,
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody).toMatchObject({
      confidentiality: "basic",
      amount: "250000000",
      recipient: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(authorization).toBe("Bearer test-jwt");
    expect(result.depositAddress).toBe(
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    );
    expect(result.transactionPayload.quoteSignature).toBe("sig-test");
  });

  it("omits confidentiality for a public live quote", async () => {
    let requestBody: Record<string, unknown> | null = null;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          quote: {
            amountIn: "1000000",
            amountInFormatted: "1.0",
            deadline: new Date(Date.now() + 600_000).toISOString(),
            depositAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    });

    await quoteNearIntents(
      liveEnv(),
      {
        sourceChain: "base",
        sourceToken: "USDC",
        destinationAddress: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "1",
        isConfidential: false,
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(requestBody).not.toBeNull();
    expect(requestBody!.confidentiality).toBeUndefined();
  });
});
