"use client";

import { useEffect, useState } from "react";
import { clientPost } from "@/lib/client";
import { Dialog } from "@/components/wave5/Dialog";
import { Field, NumericInput, Select, Toggle, ValidationMessage } from "@/components/wave2/controls";
import { Inline, Stack } from "@/components/wave1/layout";

/**
 * NEAR Intents funding modal.
 *
 * The user picks a source chain and token, enters an amount, and optionally
 * enables Confidential Intents. PASS receives only a quote from its own API;
 * the funding wallet signs nothing here and never shares a key. The deposit
 * address returned by 1Click is paid from the user's own wallet.
 */

const CHAINS = [
  { value: "ethereum", label: "Ethereum" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "base", label: "Base" },
  { value: "optimism", label: "Optimism" },
  { value: "polygon", label: "Polygon" },
  { value: "solana", label: "Solana" },
  { value: "near", label: "NEAR" },
  { value: "bitcoin", label: "Bitcoin" },
  { value: "avalanche", label: "Avalanche" },
  { value: "bnb", label: "BNB Chain" },
] as const;

const TOKENS_BY_CHAIN: Record<string, readonly string[]> = {
  ethereum: ["USDC", "USDT", "ETH"],
  arbitrum: ["USDC", "USDT", "ETH", "ARB"],
  base: ["USDC", "ETH"],
  optimism: ["USDC", "USDT", "ETH"],
  polygon: ["USDC", "USDT"],
  solana: ["USDC", "USDT", "SOL"],
  near: ["USDC", "USDT", "NEAR"],
  bitcoin: ["BTC"],
  avalanche: ["USDC", "USDT", "AVAX"],
  bnb: ["USDC", "USDT", "BNB"],
};

export interface FundingQuote {
  depositAddress: string;
  confidentiality: "basic" | null;
  source: {
    chain: string;
    token: string;
    amount: string;
  };
  destination: {
    chain: string;
    address: string;
  };
  quote: {
    amountIn: string;
    amountInFormatted: string;
    amountOut: string | null;
    amountOutFormatted?: string | null;
    minAmountOut: string | null;
    minAmountOutFormatted?: string | null;
    deadline: string | null;
    timeEstimate: number | null;
    depositAddress: string;
  };
  transactionPayload: {
    to: string;
    chain: string;
    asset: string;
    amount: string;
    memo: string | null;
    quoteSignature: string | null;
  };
  mode?: string;
  poweredBy?: string;
  note?: string;
}

export interface FundingQuoteRequest {
  sourceChain: string;
  sourceToken: string;
  destinationAddress: string;
  amount: string;
  isConfidential: boolean;
}

export interface FundWithAnyChainProps {
  open: boolean;
  onClose: () => void;
  /** The PASS trading account address the USDC lands in. */
  destinationAddress: string | null;
  /** Injectable quote call for tests (default: POST /api/v1/funding/intents/quote). */
  onQuote?: (body: FundingQuoteRequest) => Promise<FundingQuote>;
  /** Fired after a successful confidential quote so Settings can show the badge. */
  onConfidentialUsed?: () => void;
  defaultConfidential?: boolean;
}

function defaultQuote(body: FundingQuoteRequest): Promise<FundingQuote> {
  return clientPost<FundingQuote>("/api/v1/funding/intents/quote", body);
}

function short(value: string | null): string {
  if (!value) return "—";
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export function FundWithAnyChain({
  open,
  onClose,
  destinationAddress,
  onQuote = defaultQuote,
  onConfidentialUsed,
  defaultConfidential = false,
}: FundWithAnyChainProps) {
  const [chain, setChain] = useState<string>("ethereum");
  const [token, setToken] = useState<string>("USDC");
  const [amount, setAmount] = useState("");
  const [confidential, setConfidential] = useState(defaultConfidential);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FundingQuote | null>(null);

  // Reset only when the dialog OPENS. Parent preference changes (for example
  // after a confidential quote marks the account privacy-enabled) must not
  // wipe the deposit address the user is about to pay.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setConfidential(defaultConfidential);
  }, [open]);

  const tokens = TOKENS_BY_CHAIN[chain] ?? ["USDC"];

  const selectChain = (next: string) => {
    setChain(next);
    const supported = TOKENS_BY_CHAIN[next] ?? ["USDC"];
    if (!supported.includes(token)) setToken(supported[0] ?? "USDC");
    setResult(null);
  };

  const submit = async () => {
    setError(null);
    if (!destinationAddress) {
      setError("Link a trading wallet in Settings before funding it.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    try {
      const quote = await onQuote({
        sourceChain: chain,
        sourceToken: token,
        destinationAddress,
        amount,
        isConfidential: confidential,
      });
      setResult(quote);
      if (confidential) onConfidentialUsed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a funding quote.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Fund with any chain"
      action={
        <button type="button" className="pass-btn" data-variant="secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <Stack gap="4">
        <Inline gap="3" align="center">
          <span className="pass-badge pass-near-badge" data-tone="active">
            Powered by NEAR Intents
          </span>
        </Inline>

        <p className="pass-note">
          Deposit USDC from another chain straight into your PASS trading
          account. PASS never holds the funds or a key.
        </p>

        {!destinationAddress ? (
          <p className="pass-validation" role="alert">
            Link a trading wallet in Settings before funding it.
          </p>
        ) : null}

        <Field label="Source chain">
          {({ controlId }) => (
            <Select
              id={controlId}
              value={chain}
              options={CHAINS.map((c) => ({ value: c.value, label: c.label }))}
              onChange={selectChain}
            />
          )}
        </Field>

        <Field label="Token">
          {({ controlId }) => (
            <Select
              id={controlId}
              value={token}
              options={tokens.map((t) => ({ value: t, label: t }))}
              onChange={(next) => {
                setToken(next);
                setResult(null);
              }}
            />
          )}
        </Field>

        <Field
          label="Amount"
          helper={`You pay ${token} on ${CHAINS.find((c) => c.value === chain)?.label ?? chain}.`}
        >
          {({ controlId, describedBy }) => (
            <NumericInput
              id={controlId}
              value={amount}
              onChange={setAmount}
              describedBy={describedBy}
              placeholder="100.00"
              suffix={token}
            />
          )}
        </Field>

        <Toggle
          id="confidential-intents"
          checked={confidential}
          onChange={setConfidential}
          label="Use Confidential Intents (Privacy)"
        />

        <p className="pass-note">
          Confidential deposits hide the link between your funding wallet and
          your PASS trading account.
        </p>

        {error ? <ValidationMessage>{error}</ValidationMessage> : null}

        {result ? (
          <div className="pass-intent-quote" data-testid="funding-quote">
            <Stack gap="2">
              <Inline gap="2" align="center">
                <strong>Deposit address</strong>
                {result.confidentiality === "basic" ? (
                  <span className="pass-badge" data-tone="active">
                    Privacy enabled
                  </span>
                ) : null}
              </Inline>
              <code className="pass-agent-key" aria-label="NEAR Intents deposit address">
                {result.depositAddress}
              </code>
              <p className="pass-stale">
                Send exactly {result.quote.amountInFormatted} {result.source.token} on{" "}
                {result.source.chain}. Expected receive:{" "}
                {result.quote.amountOutFormatted ?? result.quote.amountOut ?? "—"} USDC
                on HyperCore.
              </p>
              {result.quote.deadline ? (
                <p className="pass-stale">
                  Quote expires {new Date(result.quote.deadline).toLocaleString()}.
                </p>
              ) : null}
              <p className="pass-stale">
                Transaction payload: {short(result.transactionPayload.to)} ·{" "}
                {result.transactionPayload.chain} · {result.transactionPayload.amount}
              </p>
            </Stack>
          </div>
        ) : (
          <Inline gap="3">
            <button
              type="button"
              className="pass-btn"
              data-variant="primary"
              disabled={busy || !destinationAddress}
              onClick={submit}
            >
              {busy ? "Getting quote…" : "Get deposit address"}
            </button>
          </Inline>
        )}
      </Stack>
    </Dialog>
  );
}
