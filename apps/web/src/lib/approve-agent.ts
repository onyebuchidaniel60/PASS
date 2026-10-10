"use client";

import {
  generateAgentKey,
  messageForDerivation,
  persistAgentKey,
} from "./agent-keystore";
import {
  APPROVE_AGENT_PRIMARY_TYPE,
  APPROVE_AGENT_TYPES,
  HL_DOMAIN,
  buildApproveAgentAction,
  nowNonce,
} from "./hyperliquid";

/**
 * First-execution agent approval (docs/DECISIONS.md D-019.1), as a callable.
 *
 * The same steps `ApproveAgentControl` performs, extracted so the Take flow
 * can run them inline before signing its first order:
 *  1. generate a fresh agent key in the browser (viem);
 *  2. derive the storage secret from a master-wallet message signature
 *     (non-fatal — without it the key stays in memory only, D-019.2);
 *  3. the MASTER wallet signs the approveAgent EIP-712 payload;
 *  4. POST only { agentAddress, nonce, signature } — the key never leaves;
 *  5. persist the key encrypted after the provider accepts (never before).
 *
 * Signing is injected so this is unit-testable without a wallet.
 */
export async function runApproveAgent(deps: {
  accountId: string;
  address: `0x${string}`;
  signMessageAsync: (args: { message: string }) => Promise<string>;
  signTypedDataAsync: (args: unknown) => Promise<`0x${string}`>;
  postApprove: (
    accountId: string,
    body: { agentAddress: `0x${string}`; nonce: number; signature: `0x${string}` },
  ) => Promise<{ agentAddress?: string }>;
}): Promise<{ agentAddress: `0x${string}`; persisted: boolean; warning?: string }> {
  const { privateKey, agentAddress } = generateAgentKey();

  let derivationSecret: string | null = null;
  try {
    derivationSecret = await deps.signMessageAsync({
      message: messageForDerivation(deps.address),
    });
  } catch {
    derivationSecret = null;
  }

  const nonce = nowNonce();
  const action = buildApproveAgentAction({ agentAddress, nonce });

  // wagmi's typed-data generics are narrowed to standard EIP-712 primary
  // types; Hyperliquid's is documented as
  // "HyperliquidTransaction:<ActionTypeName>", so the payload is passed
  // through structurally.
  const signature = await deps.signTypedDataAsync({
    domain: HL_DOMAIN,
    types: APPROVE_AGENT_TYPES,
    primaryType: APPROVE_AGENT_PRIMARY_TYPE,
    message: {
      hyperliquidChain: action.hyperliquidChain,
      signatureChainId: action.signatureChainId,
      agentAddress: action.agentAddress,
      nonce: BigInt(action.nonce),
      isMainnet: true,
    },
  } as never);

  const res = await deps.postApprove(deps.accountId, {
    agentAddress,
    nonce,
    signature,
  });

  const stored = await persistAgentKey(
    privateKey,
    (res.agentAddress ?? agentAddress) as `0x${string}`,
    deps.address,
    derivationSecret,
  );

  return { agentAddress, persisted: stored.persisted, warning: stored.warning };
}
