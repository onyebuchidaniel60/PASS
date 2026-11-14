"use client";

import { useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { clientGet, clientPost } from "@/lib/client";
import { runRevokeAgent } from "@/lib/revoke-agent";
import { venueToHLChain } from "@/lib/hyperliquid";
import { Inline, Panel, Stack } from "@/components/wave1/layout";
import { StatusBadge } from "@/components/reference";
import { Toggle, ValidationMessage } from "@/components/wave2/controls";
import { truncateAddress } from "@/lib/format";

function RestrictionIcon() {
  return (
    <span className="pass-security-restriction" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8 12h8" />
      </svg>
    </span>
  );
}

export interface SecurityAccount {
  id: string;
  accountAddress: string;
  agentAddress: string | null;
  venue?: string | null;
  agentApproved?: boolean;
}

export interface SecuritySectionProps {
  account: SecurityAccount | null;
  confidentialEnabled: boolean;
  onConfidentialChange: (enabled: boolean) => void;
  /** Inject the full revocation for tests; production uses the wallet flow. */
  onRevoke?: () => Promise<void>;
  onRevoked?: () => void;
}

/**
 * Non-Custodial Security dashboard (NEAR Hackathon SEC track).
 *
 * The Agent Key can sign trade actions only. It cannot withdraw, transfer, or
 * change account settings — those actions need the master wallet. Revocation
 * registers a throwaway replacement agent on Hyperliquid, which deregisters
 * PASS's current unnamed agent, then clears the local association.
 */
export function SecuritySection({
  account,
  confidentialEnabled,
  onConfidentialChange,
  onRevoke,
  onRevoked,
}: SecuritySectionProps) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const approved = Boolean(
    account?.agentAddress && (account.agentApproved ?? true),
  );

  const revoke = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (onRevoke) {
        await onRevoke();
      } else {
        if (!account) throw new Error("No trading account is linked.");
        if (!isConnected || !address) {
          throw new Error("Connect the master wallet before revoking the agent key.");
        }
        const health = await clientGet<{ hyperliquidVenue?: string | null }>("/health");
        const chain = venueToHLChain(health?.hyperliquidVenue ?? account.venue ?? null);
        if (!chain) {
          throw new Error(
            "The signing venue is unknown. Reload the page and try again — PASS will not guess Mainnet.",
          );
        }
        await runRevokeAgent({
          masterAddress: address,
          revokedAgentAddress: account.agentAddress ?? "",
          chain,
          signTypedDataAsync: (args) => signTypedDataAsync(args as never),
          postRevoke: (masterAddress, body) =>
            clientPost<{ ok: boolean }>(
              `/api/v1/trading-accounts/${masterAddress}/revoke-agent`,
              body as unknown as Record<string, unknown>,
            ),
        });
      }
      setConfirming(false);
      setMessage(
        "Agent key revoked. PASS cannot sign an order until you approve a new agent.",
      );
      onRevoked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke the agent key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <Stack gap="5">
        <Stack gap="2">
          <Inline gap="3" align="center">
            <h2 style={{ fontSize: "var(--type-title-s-size)" }}>Security</h2>
            {confidentialEnabled ? (
              <span className="pass-badge" data-tone="active" data-testid="privacy-badge">
                Privacy Enabled
              </span>
            ) : null}
          </Inline>
          <p className="pass-stale">
            PASS is non-custodial. The Hyperliquid agent key can place and
            cancel trade orders for your account, and nothing else.
          </p>
        </Stack>

        <div className="pass-security-status" data-testid="agent-key-status">
          <Stack gap="2">
            <span className="pass-field-label">Hyperliquid Agent Key</span>
            <Inline gap="3" align="center">
              <StatusBadge
                tone={approved ? "active" : "cancelled"}
                label={approved ? "Approved" : "Not Approved"}
              />
              {account ? (
                <span className="pass-stale">
                  Trading account {truncateAddress(account.accountAddress)}
                  {account.agentAddress
                    ? ` · agent ${truncateAddress(account.agentAddress)}`
                    : ""}
                </span>
              ) : (
                <span className="pass-stale">No trading account linked.</span>
              )}
            </Inline>
          </Stack>
        </div>

        <Stack gap="2">
          <strong>What the Agent Key cannot do</strong>
          <ul className="pass-security-list">
            <li>
              <RestrictionIcon />
              <span>Cannot withdraw funds</span>
            </li>
            <li>
              <RestrictionIcon />
              <span>Cannot transfer tokens</span>
            </li>
            <li>
              <RestrictionIcon />
              <span>Cannot change account settings</span>
            </li>
          </ul>
          <p className="pass-stale">
            Withdrawals, transfers, and account changes require your master
            wallet signature. PASS never holds that key.
          </p>
        </Stack>

        <Stack gap="3">
          <strong>Confidential Intents</strong>
          <Toggle
            id="security-confidential-intents"
            checked={confidentialEnabled}
            onChange={onConfidentialChange}
            label="Use Confidential Intents (Privacy)"
          />
          <p className="pass-stale">
            When enabled, new funding quotes route through NEAR&apos;s private
            shard so the deposit cannot be linked to this trading account.
          </p>
        </Stack>

        {confirming ? (
          <Stack gap="3">
            <p className="pass-thesis">
              Revoke PASS&apos;s agent key? Hyperliquid deregisters the current
              unnamed agent by registering a throwaway replacement. You will
              need to approve a new agent before your next Take.
            </p>
            <Inline gap="3">
              <button
                type="button"
                className="pass-btn"
                data-variant="destructive"
                disabled={busy}
                onClick={revoke}
              >
                {busy ? "Revoking…" : "Confirm revoke"}
              </button>
              <button
                type="button"
                className="pass-btn"
                data-variant="secondary"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </Inline>
          </Stack>
        ) : (
          <Inline gap="3" align="center">
            <button
              type="button"
              className="pass-btn"
              data-variant="destructive"
              disabled={!approved}
              onClick={() => setConfirming(true)}
            >
              Revoke Agent Key
            </button>
            {!approved ? (
              <span className="pass-stale">No agent key is currently approved.</span>
            ) : !isConnected ? (
              <span className="pass-stale">
                Connect the master wallet to revoke.
              </span>
            ) : null}
          </Inline>
        )}

        {error ? <ValidationMessage>{error}</ValidationMessage> : null}
        {message ? (
          <p className="pass-note" role="status">
            {message}
          </p>
        ) : null}
      </Stack>
    </Panel>
  );
}
