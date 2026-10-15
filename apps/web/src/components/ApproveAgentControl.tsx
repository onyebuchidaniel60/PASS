"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import { Button } from "@pass/ui";
import { clientGet, clientPost } from "@/lib/client";
import { hasAgentKeyInMemory } from "@/lib/agent-keystore";
import { isUserRejection, runApproveAgent } from "@/lib/approve-agent";
import {
  approveAgentDomain,
  venueToHLChain,
  type HLChain,
} from "@/lib/hyperliquid";

/**
 * Approve a Hyperliquid API/agent wallet (docs/DECISIONS.md D-019.1, D-027).
 *
 *  1. Generate a fresh agent key in the browser (viem generatePrivateKey).
 *  2. Derive its address (privateKeyToAccount).
 *  3. The MASTER wallet signs the approveAgent EIP-712 payload.
 *  4. POST the signature to the address-keyed API route, which relays it (D-018.3).
 *  5. Persist the agent key encrypted under a wallet-derived secret (D-019.2).
 *
 * D-027: wallets are execution devices, not owned. Approval addresses the
 * wallet itself — no row id, no session, no ownership. The agent private
 * key is never sent to the API and never logged. If Hyperliquid rejects
 * the approval the key is NOT persisted.
 */
export function ApproveAgentControl({ accountAddress }: { accountAddress: string | null }) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  // Signing chain from /health via venueToHLChain — the server's own config,
  // never a hardcoded default. Null means unknown: an unreachable /health
  // (or an unrecognised venue) must refuse to sign rather than silently
  // default to Mainnet, which on testnet produces a Mainnet-labelled
  // approval the wallet must reject (live MetaMask refusal: 'Provided
  // chainId "42161" must match the active chainId "421614"').
  const [approvalChain, setApprovalChain] = useState<HLChain | null>(null);
  const [venueReady, setVenueReady] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clientGet<{ hyperliquidVenue?: string | null }>("/health").then(
      (h) => {
        if (cancelled) return;
        const chain = venueToHLChain(h?.hyperliquidVenue ?? null);
        setApprovalChain(chain);
        setVenueError(
          chain
            ? null
            : `The server reported venue "${h?.hyperliquidVenue ?? "unknown"}", which has no signing chain. Refusing to sign rather than guessing.`,
        );
        setVenueReady(true);
      },
      () => {
        if (cancelled) return;
        setApprovalChain(null);
        setVenueError(
          "Could not reach /health, so the signing venue is unknown. Refusing to sign rather than guessing Mainnet.",
        );
        setVenueReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isConnected) return null;

  async function approve() {
    if (!accountAddress || !address) {
      setMsg("Connect a wallet before approving an agent.");
      return;
    }
    // Fail closed without a verified venue: no chain, no signature.
    if (!approvalChain) {
      setMsg(
        venueError ??
          "The signing venue is still unknown. Wait for it to load or reload before approving.",
      );
      return;
    }
    // Wallet/venue agreement before any popup: a wallet on the wrong
    // network for the venue names both chains instead of requesting a
    // signature the wallet must refuse.
    const expectedDomain = approveAgentDomain(approvalChain).chainId;
    if (typeof walletChainId === "number" && walletChainId !== expectedDomain) {
      const wantNet =
        approvalChain === "Testnet" ? "Arbitrum Sepolia" : "Arbitrum One";
      setMsg(
        `Chain mismatch: your wallet is on chain ${walletChainId} but venue ` +
          `"${approvalChain}" requires domain ${expectedDomain}. Switch your ` +
          `wallet to ${wantNet} and try again. No signature was requested.`,
      );
      return;
    }
    setBusy(true);
    setMsg(null);

    try {
      const { persisted, warning, skipped } = await runApproveAgent({
        accountId: accountAddress,
        address,
        chain: approvalChain,
        signMessageAsync: (args) => signMessageAsync(args),
        signTypedDataAsync: (args) => signTypedDataAsync(args as never),
        postApprove: (walletAddress, body) =>
          clientPost<{ agentAddress: string; mode: string }>(
            `/api/v1/trading-accounts/${walletAddress}/approve-agent`,
            body as unknown as Record<string, unknown>,
          ),
      });

      setApproved(true);
      setMsg(
        skipped
          ? "This agent is already approved — no new signature was needed."
          : persisted
            ? "Agent approved. Its key is stored encrypted in this browser."
            : (warning ?? "Agent approved for this session."),
      );
    } catch (err) {
      const e = err as Error & { code?: string };
      // Only a wallet-reported cancellation reads as one; a provider
      // rejection surfaces verbatim with its code.
      const text = isUserRejection(err)
        ? "You cancelled the wallet signature. No agent was approved."
        : e.code
          ? `${e.code}: ${e.message}`
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
        <Button
          disabled={busy || !accountAddress || !approvalChain}
          onClick={approve}
        >
          {busy ? "Approving…" : "Approve agent wallet"}
        </Button>
      )}
      {venueReady && !approvalChain && venueError && (
        <p role="note" className="pass-note pass-note-status">
          {venueError}
        </p>
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