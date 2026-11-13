import { randomUUID } from "node:crypto";
import type { ApiEnv, RunMode } from "@pass/contracts";
import { AppError } from "../errors.js";

/**
 * NEAR Intents 1Click API integration.
 *
 * PASS uses the 1Click quote flow to fund a Hyperliquid trading account from
 * any supported chain. `confidentiality: "basic"` routes the swap through
 * NEAR's private shard: the origin-chain deposit and the HyperCore withdrawal
 * cannot be linked on-chain. The API holds no key material — the quote only
 * names a deposit address the user pays from their own wallet.
 *
 * Reference:
 * https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps
 */

export interface NearAssetRef {
  assetId: string;
  symbol: string;
  decimals: number;
}

/** Canonical source-chain keys used by the API and the web client. */
export const NEAR_SOURCE_CHAINS = [
  "ethereum",
  "arbitrum",
  "base",
  "optimism",
  "polygon",
  "solana",
  "near",
  "bitcoin",
  "avalanche",
  "bnb",
] as const;

export type NearSourceChain = (typeof NEAR_SOURCE_CHAINS)[number];

const CHAIN_ALIASES: Record<string, NearSourceChain> = {
  eth: "ethereum",
  ethereum: "ethereum",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  base: "base",
  op: "optimism",
  optimism: "optimism",
  pol: "polygon",
  polygon: "polygon",
  sol: "solana",
  solana: "solana",
  near: "near",
  btc: "bitcoin",
  bitcoin: "bitcoin",
  avax: "avalanche",
  avalanche: "avalanche",
  bnb: "bnb",
  bsc: "bnb",
};

/** 1Click's own `blockchain` identifiers, used in quote responses. */
const CHAIN_TO_1CLICK: Record<NearSourceChain, string> = {
  ethereum: "eth",
  arbitrum: "arb",
  base: "base",
  optimism: "op",
  polygon: "pol",
  solana: "sol",
  near: "near",
  bitcoin: "btc",
  avalanche: "avax",
  bnb: "bsc",
};

/**
 * Curated source assets. Asset IDs are 1Click's own (verified against
 * GET /v0/tokens), not guessed contract addresses.
 */
const SOURCE_ASSETS: Record<NearSourceChain, Record<string, NearAssetRef>> = {
  ethereum: {
    USDC: {
      assetId: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
      symbol: "USDC",
      decimals: 6,
    },
    USDT: {
      assetId: "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near",
      symbol: "USDT",
      decimals: 6,
    },
    ETH: { assetId: "nep141:eth.omft.near", symbol: "ETH", decimals: 18 },
  },
  arbitrum: {
    USDC: {
      assetId: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
      symbol: "USDC",
      decimals: 6,
    },
    USDT: {
      assetId: "nep141:arb-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9.omft.near",
      symbol: "USDT",
      decimals: 6,
    },
    ETH: { assetId: "nep141:arb.omft.near", symbol: "ETH", decimals: 18 },
    ARB: {
      assetId: "nep141:arb-0x912ce59144191c1204e64559fe8253a0e49e6548.omft.near",
      symbol: "ARB",
      decimals: 18,
    },
  },
  base: {
    USDC: {
      assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
      symbol: "USDC",
      decimals: 6,
    },
    ETH: { assetId: "nep141:base.omft.near", symbol: "ETH", decimals: 18 },
  },
  optimism: {
    USDC: {
      assetId: "nep245:v2_1.omni.hot.tg:10_A2ewyUyDp6qsue1jqZsGypkCxRJ",
      symbol: "USDC",
      decimals: 6,
    },
    USDT: {
      assetId: "nep245:v2_1.omni.hot.tg:10_359RPSJVdTxwTJT9TyGssr2rFoWo",
      symbol: "USDT",
      decimals: 6,
    },
    ETH: {
      assetId: "nep245:v2_1.omni.hot.tg:10_11111111111111111111",
      symbol: "ETH",
      decimals: 18,
    },
  },
  polygon: {
    USDC: {
      assetId: "nep141:pol-0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.omdep.near",
      symbol: "USDC",
      decimals: 6,
    },
    USDT: {
      assetId: "nep141:pol-0xc2132d05d31c914a87c6611c10748aeb04b58e8f.omdep.near",
      symbol: "USDT",
      decimals: 6,
    },
  },
  solana: {
    USDC: {
      assetId: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
      symbol: "USDC",
      decimals: 6,
    },
    USDT: {
      assetId: "nep141:sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near",
      symbol: "USDT",
      decimals: 6,
    },
    SOL: { assetId: "nep141:sol.omft.near", symbol: "SOL", decimals: 9 },
  },
  near: {
    USDC: {
      assetId:
        "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      symbol: "USDC",
      decimals: 6,
    },
    USDT: {
      assetId: "nep141:usdt.tether-token.near",
      symbol: "USDT",
      decimals: 6,
    },
    NEAR: { assetId: "nep141:wrap.near", symbol: "NEAR", decimals: 24 },
  },
  bitcoin: {
    BTC: { assetId: "nep141:btc.omft.near", symbol: "BTC", decimals: 8 },
  },
  avalanche: {
    USDC: {
      assetId: "nep141:avax-0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e.omdep.near",
      symbol: "USDC",
      decimals: 6,
    },
    USDT: {
      assetId: "nep141:avax-0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7.omdep.near",
      symbol: "USDT",
      decimals: 6,
    },
    AVAX: { assetId: "nep141:avax.omdep.near", symbol: "AVAX", decimals: 18 },
  },
  bnb: {
    USDC: {
      assetId: "nep141:bnb-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d.omdep.near",
      symbol: "USDC",
      decimals: 18,
    },
    USDT: {
      assetId: "nep141:bnb-0x55d398326f99059ff775485246999027b3197955.omdep.near",
      symbol: "USDT",
      decimals: 18,
    },
    BNB: { assetId: "nep141:bnb.omdep.near", symbol: "BNB", decimals: 18 },
  },
};

/**
 * USDC on HyperCore, 1Click's direct Hyperliquid destination. Overridable so
 * a deployment can target another HyperCore representation without a code
 * change.
 */
export const DEFAULT_NEAR_DESTINATION_ASSET =
  "1cs_v1:hypercore:erc20:0xb88339CB7199b77E23DB6E890353E22632Ba630f";

/** Chains where the PASS trading address is also a valid refund address. */
const EVM_OR_SOLANA = new Set<NearSourceChain>([
  "ethereum",
  "arbitrum",
  "base",
  "optimism",
  "polygon",
  "solana",
  "avalanche",
  "bnb",
]);

export interface NearIntentsConfig {
  mode: RunMode;
  apiUrl: string;
  jwt: string | null;
  destinationAsset: string;
}

export function nearIntentsConfig(env: ApiEnv): NearIntentsConfig {
  return {
    mode: env.NEAR_INTENTS_MODE,
    apiUrl: (env.NEAR_INTENTS_API_URL ?? "https://1click.chaindefuser.com").replace(
      /\/$/,
      "",
    ),
    jwt: env.NEAR_INTENTS_JWT ?? null,
    destinationAsset: env.NEAR_INTENTS_DESTINATION_ASSET ?? DEFAULT_NEAR_DESTINATION_ASSET,
  };
}

export interface NearQuoteInput {
  sourceChain: string;
  sourceToken: string;
  destinationAddress: string;
  amount: string;
  isConfidential: boolean;
  refundAddress?: string;
}

export interface NearQuoteResult {
  mode: RunMode;
  source: {
    chain: NearSourceChain;
    chainId: string;
    token: string;
    assetId: string;
    decimals: number;
    amount: string;
    amountAtomic: string;
  };
  destination: {
    chain: "hypercore";
    asset: string;
    address: string;
  };
  confidentiality: "basic" | null;
  depositAddress: string;
  transactionPayload: {
    to: string;
    chain: string;
    asset: string;
    amount: string;
    memo: string | null;
    quoteSignature: string | null;
  };
  quote: {
    amountIn: string;
    amountInFormatted: string;
    amountOut: string | null;
    amountOutFormatted: string | null;
    minAmountOut: string | null;
    minAmountOutFormatted: string | null;
    deadline: string | null;
    timeEstimate: number | null;
    depositAddress: string;
  };
  /** Raw upstream envelope, kept for diagnostics without secret material. */
  providerQuote: Record<string, unknown>;
  observedAt: string;
}

function canonicalChain(value: string): NearSourceChain {
  const key = value.trim().toLowerCase();
  const chain = CHAIN_ALIASES[key];
  if (!chain) {
    throw new AppError(
      "INVALID_REQUEST",
      `Unsupported source chain "${value}". Supported chains: ${NEAR_SOURCE_CHAINS.join(", ")}.`,
    );
  }
  return chain;
}

function resolveSourceAsset(
  chain: NearSourceChain,
  token: string,
): NearAssetRef {
  const key = token.trim().toUpperCase();
  // An explicit 1Click asset id is accepted as-is; decimals then come from
  // the caller's token string only when the common 6-decimal default applies.
  if (/^(nep141|nep245|1cs_v1):/i.test(token)) {
    return { assetId: token, symbol: key, decimals: 6 };
  }
  const found = SOURCE_ASSETS[chain][key];
  if (!found) {
    throw new AppError(
      "INVALID_ASSET",
      `Source token "${token}" is not supported on ${chain}. Supported: ${Object.keys(
        SOURCE_ASSETS[chain],
      ).join(", ")}.`,
    );
  }
  return found;
}

/** Decimal string -> atomic units, without floating-point rounding. */
export function toAtomicAmount(amount: string, decimals: number): string {
  const clean = amount.trim();
  if (!/^\d+(?:\.\d+)?$/.test(clean)) {
    throw new AppError("INVALID_REQUEST", "Amount must be a positive decimal number.");
  }
  const [whole, fraction = ""] = clean.split(".");
  if (fraction.length > decimals) {
    throw new AppError(
      "INVALID_REQUEST",
      `Amount supports at most ${decimals} decimal places for this token.`,
    );
  }
  const atomic = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  if (atomic === "" || atomic === "0") {
    throw new AppError("INVALID_REQUEST", "Amount must be greater than zero.");
  }
  return atomic;
}

function mockDepositAddress(confidential: boolean): string {
  const hex = randomUUID().replace(/-/g, "").padEnd(40, "0").slice(0, 40);
  return `${confidential ? "0xc0" : "0xd0"}${hex.slice(2)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Atomic integer string -> human decimal string. */
function formatAtomic(value: string | null, decimals: number): string | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/** HyperCore USDC uses 6 decimals on the default 1Click destination asset. */
const DESTINATION_DECIMALS = 6;

/**
 * Requests a 1Click quote. In mock mode no network call is made.
 *
 * The live request sets `confidentiality: "basic"` when the user opts in.
 * 1Click requires an authenticated JWT for confidential quotes; a 401 is
 * surfaced as a configuration error rather than silently downgrading the
 * user to a public swap.
 */
export async function quoteNearIntents(
  env: ApiEnv,
  input: NearQuoteInput,
  fetchImpl: typeof fetch = fetch,
): Promise<NearQuoteResult> {
  const config = nearIntentsConfig(env);
  const chain = canonicalChain(input.sourceChain);
  const asset = resolveSourceAsset(chain, input.sourceToken);
  const amountAtomic = toAtomicAmount(input.amount, asset.decimals);
  const destinationAsset = config.destinationAsset;
  const deadline = new Date(Date.now() + 15 * 60_000).toISOString();

  const refundAddress =
    input.refundAddress?.trim() ||
    (EVM_OR_SOLANA.has(chain) ? input.destinationAddress.trim() : "");
  const quoteRequest: Record<string, unknown> = {
    dry: false,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: asset.assetId,
    depositType: "ORIGIN_CHAIN",
    destinationAsset,
    amount: amountAtomic,
    recipient: input.destinationAddress.trim(),
    recipientType: "DESTINATION_CHAIN",
    deadline,
    ...(refundAddress
      ? { refundTo: refundAddress, refundType: "ORIGIN_CHAIN" }
      : {}),
  };
  if (input.isConfidential) quoteRequest.confidentiality = "basic";

  let providerQuote: Record<string, unknown>;
  if (config.mode === "mock") {
    const amountOut = toAtomicAmount(input.amount, 6);
    providerQuote = {
      quote: {
        amountIn: amountAtomic,
        amountInFormatted: input.amount.trim(),
        amountOut,
        minAmountOut: amountOut,
        deadline,
        timeEstimate: 45,
        depositAddress: mockDepositAddress(input.isConfidential),
      },
      quoteRequest: {
        ...quoteRequest,
        confidentiality: input.isConfidential ? "basic" : "public",
      },
      signature: null,
      timestamp: new Date().toISOString(),
      correlationId: `mock_${randomUUID()}`,
      mock: true,
    };
  } else {
    let response: Response;
    try {
      response = await fetchImpl(`${config.apiUrl}/v0/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.jwt ? { Authorization: `Bearer ${config.jwt}` } : {}),
        },
        body: JSON.stringify(quoteRequest),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        `Could not reach NEAR Intents: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!response.ok) {
      if (response.status === 401 && input.isConfidential) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "NEAR Intents requires an authenticated 1Click JWT for confidential quotes. Set NEAR_INTENTS_JWT on the API.",
          { status: response.status, upstream: parsed },
        );
      }
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        `NEAR Intents answered ${response.status}: ${text.slice(0, 300)}`,
        { status: response.status, upstream: parsed },
      );
    }
    providerQuote = asRecord(parsed);
  }

  const quote = asRecord(providerQuote.quote);
  const depositAddress = stringOrNull(quote.depositAddress);
  if (!depositAddress) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "NEAR Intents did not return a deposit address for this quote.",
    );
  }
  const quoteRequestEcho = asRecord(providerQuote.quoteRequest);
  const quoteDeadline =
    stringOrNull(quote.deadline) ?? stringOrNull(quoteRequestEcho.deadline);
  const amountOut = stringOrNull(quote.amountOut);
  const minAmountOut = stringOrNull(quote.minAmountOut);

  return {
    mode: config.mode,
    source: {
      chain,
      chainId: CHAIN_TO_1CLICK[chain],
      token: asset.symbol,
      assetId: asset.assetId,
      decimals: asset.decimals,
      amount: input.amount.trim(),
      amountAtomic,
    },
    destination: {
      chain: "hypercore",
      asset: destinationAsset,
      address: input.destinationAddress.trim(),
    },
    confidentiality: input.isConfidential ? "basic" : null,
    depositAddress,
    transactionPayload: {
      to: depositAddress,
      chain: CHAIN_TO_1CLICK[chain],
      asset: asset.assetId,
      amount: amountAtomic,
      memo: stringOrNull(quote.depositMemo),
      quoteSignature: stringOrNull(providerQuote.signature),
    },
    quote: {
      amountIn: stringOrNull(quote.amountIn) ?? amountAtomic,
      amountInFormatted: stringOrNull(quote.amountInFormatted) ?? input.amount.trim(),
      amountOut,
      amountOutFormatted:
        stringOrNull(quote.amountOutFormatted) ??
        formatAtomic(amountOut, DESTINATION_DECIMALS),
      minAmountOut,
      minAmountOutFormatted:
        stringOrNull(quote.minAmountOutFormatted) ??
        formatAtomic(minAmountOut, DESTINATION_DECIMALS),
      deadline: quoteDeadline,
      timeEstimate: numberOrNull(quote.timeEstimate),
      depositAddress,
    },
    providerQuote,
    observedAt: new Date().toISOString(),
  };
}
