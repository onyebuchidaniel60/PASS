"use client";

import { useState } from "react";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import { Button } from "@pass/ui";
import { clientPost } from "@/lib/client";
import { hasAgentKeyInMemory } from "@/lib/agent-keystore";
import { runApproveAgent } from "@/lib/approve-agent";

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
      const { persisted, warning } = await runApproveAgent({
        accountId,
        address,
        signMessageAsync: (args) => signMessageAsync(args),
        signTypedDataAsync: (args) => signTypedDataAsync(args as never),
        postApprove: (id, body) =>
          clientPost<{ agentAddress: string; mode: string }>(
            `/api/v1/me/trading-accounts/${id}/approve-agent`,
            body as Record<string, unknown>,
          ),
      });

      setApproved(true);
      setMsg(
        persisted
          ? "Agent approved. Its key is stored encrypted in this browser."
          : (warning ?? "Agent approved for this session."),
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

/**
 * The topbar's wallet slot.
 *
 * THIS USED TO BE THIS COMPONENT, and it was the reported bug:
 *
 *     const { isConnected } = useAccount();
 *     if (isConnected) return null;
 *     return <ConnectKitButton />;
 *
 * `return null` on connect meant the whole right-hand region of the topbar
 * vanished the moment a wallet connected — no address, no disconnect, no way
 * back. It now lives in `WalletControl`, which authors the connected state
 * rather than delegating it to ConnectKit's own (Tailwind-styled) dropdown.
 * Re-exported here so existing importers keep working.
 */
export { WalletControl as ConnectWalletEntry } from "@/components/WalletControl";