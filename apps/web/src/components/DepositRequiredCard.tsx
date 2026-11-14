"use client";

import { Alert } from "@/components/wave2/controls";

/**
 * Hyperliquid rejects an order from an unfunded account with a provider string
 * such as "Must deposit before performing actions". That is not a failed order
 * the Taker can debug in the form; it is a funding step. Keep the detection in
 * one place so every Take-flow error branch treats it the same way.
 */
export function isDepositRequiredError(
  reason: string | null | undefined,
): boolean {
  if (!reason) return false;
  return /must deposit before performing actions|deposit before performing actions|insufficient (?:funds|balance)|not enough (?:funds|balance)/i.test(
    reason,
  );
}

export function DepositRequiredCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert
      tone="warning"
      title="Action Required: Deposit Funds on Hyperliquid"
      action={
        <>
          <a
            className="pass-btn"
            data-variant="primary"
            data-size="md"
            href="https://app.hyperliquid.xyz"
            target="_blank"
            rel="noopener noreferrer"
          >
            Go to Hyperliquid to Deposit
          </a>
          <button
            type="button"
            className="pass-btn"
            data-variant="secondary"
            data-size="md"
            onClick={onRetry}
          >
            Retry
          </button>
        </>
      }
    >
      <p>
        Your trading account is currently empty. You must deposit USDC before
        you can take a trade.
      </p>
      <p className="pass-note">
        Once you have deposited, click Retry below.
      </p>
    </Alert>
  );
}
