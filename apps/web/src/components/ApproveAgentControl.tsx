"use client";

import { useState } from "react";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { Button } from "@pass/ui";
import { clientPost } from "@/lib/client";
import { Stack } from "@/components/wave1/layout";
import {
  generateAgentKey,
  messageForDerivation,
  persistAgentKey,
  hasAgentKeyInMemory,
} from "@/lib/agent-keystore";
import {
  APPROVE_AGENT_PRIMARY_TYPE,
  APPROVE_AGENT_TYPES,
  HL_DOMAIN,
  buildApproveAgentAction,
  nowNonce,
} from "@/lib/hyperliquid";

/**
 * Approve a Hyperliquid API/agent wallet (docs/DECISIONS.md D-019.1).
 *
 *  1. Generate a fresh agent key in the browser (viem generatePrivateKey).
 *  2. Derive its address (privateKeyToAccount).
 *  3. The MASTER wallet signs the approveAgent EIP-712 payload.
 *  4. POST the signature to the API, which relays it (D-018.3).
 *  5. Persist the agent key encrypted under a wallet-derived secret (D-019.2).
 *
 * The agent private key is never sent to the API and never logged. If
 * Hyperliquid rejects the approval the key is NOT persisted.
 */
export function ApproveAgentControl({ accountId }: { accountId: string | null }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);

  if (!isConnected) return null;

  async function approve() {
    if (!accountId || !address) {
      setMsg("Link a Hyperliquid account before approving an agent.");
      return;
    }
    setBusy(true);
    setMsg(null);

    try {
      const { privateKey, agentAddress } = generateAgentKey();

      // Derivation secret for local encrypted storage (D-019.2).
      // Non-fatal: without it the key stays in memory only.
      let derivationSecret: string | null = null;
      try {
        derivationSecret = await signMessageAsync({
          message: messageForDerivation(address),
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
      const signature = (await signTypedDataAsync({
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
      } as never)) as `0x${string}`;

      // Only the signature and the agent address leave the client.
      const res = await clientPost<{ agentAddress: string; mode: string }>(
        `/api/v1/me/trading-accounts/${accountId}/approve-agent`,
        { agentAddress: agentAddress as `0x${string}`, nonce, signature: signature as `0x${string}` } as Record<string, unknown>,
      );

      const stored = await persistAgentKey(
        privateKey,
        (res.agentAddress ?? agentAddress) as `0x${string}`,
        address,
        derivationSecret,
      );

      setApproved(true);
      setMsg(
        stored.persisted
          ? "Agent approved. Its key is stored encrypted in this browser."
          : (stored.warning ?? "Agent approved for this session."),
      );
    } catch (err) {
      const e = err as Error & { code?: string };
      const text =
        e.code === "SIGNATURE_REJECTED" || e.code === "ORDER_REJECTED"
          ? `Hyperliquid rejected the agent approval: ${e.message}`
          : /rejected|denied|cancell?ed/i.test(e.message)
            ? "You cancelled the wallet signature. No agent was approved."
            : e.message;
      setMsg(text);
    } finally {
      setBusy(false);
      setApproved(hasAgentKeyInMemory());
    }
  }

  return (
    <div>
      {approved ? (
        <p className="pass-note">
          An agent wallet is approved and can sign orders on your behalf.
        </p>
      ) : (
        <Button disabled={busy || !accountId} onClick={approve}>
          {busy ? "Approving…" : "Approve agent wallet"}
        </Button>
      )}
      {msg && (
        <p role="status" className="pass-note pass-note-status">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Entry point shown before a wallet is connected. */
export function ConnectWalletEntry() {
  const { isConnected } = useAccount();
  if (isConnected) return null;
  return (
    <Stack gap="2">
      <ConnectKitButton />
      <p className="pass-note">
        Connecting a wallet lets PASS request your signature to approve an agent
        wallet. PASS never receives a private key.
      </p>
    </Stack>
  );
}