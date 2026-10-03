"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  ErrorBlock,
  Field,
  LoadingBlock,
  Panel,
  Rule,
  StatusChip,
  monoInputClass,
} from "@pass/ui";
import { API_URL } from "@/lib/api";
import { clientGet, clientPost } from "@/lib/client";
import { fmtPrice, fmtUtc, statusLabel, truncateAddress } from "@/lib/format";
import {
  buildExchangeRequest,
  generateSessionAgentWallet,
  signExchangeRequest,
} from "@/lib/signer";

/**
 * docs/UX_SPEC.md §8 — four steps: choose size, review, authorize, confirm.
 * The Taker's size is always their own and is never prefilled from the
 * Trader's plan (D-015).
 */

interface PassView {
  publicId: string;
  asset: string;
  direction: string;
  status: string;
  version: number;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  leverage: string | null;
  market: { markPrice: string; observedAt: string } | null;
  trader: { displayName: string; xHandle: string | null };
}

interface Account {
  id: string;
  accountAddress: string;
  agentAddress: string | null;
  agentApproved: boolean;
  isPrimary: boolean;
}

interface Preview {
  passVersion: number;
  positionSize: string;
  leverage: string | null;
  requestedEntry: string | null;
  markPrice: string | null;
  marketObservedAt: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  slippageToleranceBps: number;
  estimatedMargin: string | null;
  warnings: { code: string; message: string }[];
  requiresConfirmation: boolean;
}

const STEPS = ["Choose size", "Review", "Authorize", "Confirmation"];

export default function TakePassPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const [publicId, setPublicId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [pass, setPass] = useState<PassView | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [size, setSize] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ executionId: string; providerOrderId: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"mock" | "live">("mock");

  useEffect(() => {
    params.then((p) => setPublicId(p.publicId));
  }, [params]);

  useEffect(() => {
    if (!publicId) return;
    setLoading(true);
    Promise.all([
      clientGet<PassView>(`/api/v1/passes/${publicId}`),
      clientGet<{ accounts: Account[]; demoMode: boolean }>("/api/v1/me/trading-accounts"),
    ])
      .then(([p, a]) => {
        setPass(p);
        setAccounts(a.accounts ?? []);
        setAccountId(a.accounts?.find((x) => x.isPrimary)?.id ?? a.accounts?.[0]?.id ?? "");
        setMode(a.demoMode ? "mock" : "live");
        if (p.status !== "active" && p.status !== "entry_pending") {
          setError(`This Pass is ${statusLabel(p.status).toLowerCase()} and cannot be taken.`);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the Pass."))
      .finally(() => setLoading(false));
  }, [publicId]);

  async function review() {
    setError(null);
    setStale(false);
    setBusy(true);
    try {
      const p = await clientPost<Preview>(`/api/v1/passes/${publicId}/execution-preview`, {
        passVersion: pass?.version,
        accountId,
        positionSize: size,
        slippageToleranceBps: 50,
      });
      setPreview(p);
      setStep(1);
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "PASS_VERSION_STALE") setStale(true);
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function authorize() {
    setError(null);
    setBusy(true);
    try {
      // The agent key is created here, in the browser, and never leaves it.
      await generateSessionAgentWallet();

      const intent = {
        asset: pass?.asset ?? "",
        isBuy: pass?.direction === "long",
        size: preview?.positionSize ?? size,
        limitPx: preview?.requestedEntry ?? preview?.markPrice ?? "0",
        leverage: Number(preview?.leverage ?? 1),
        reduceOnly: false,
      };
      const request = buildExchangeRequest(intent);
      const signed = await signExchangeRequest(mode, request);

      const clientRequestId = `req_${crypto.randomUUID()}`;
      const res = await clientPost<{ executionId: string; providerOrderId: string; status: string }>(
        `/api/v1/passes/${publicId}/executions`,
        {
          passVersion: preview?.passVersion,
          accountId,
          clientRequestId,
          signedPayload: signed,
        },
      );
      setResult(res);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading Pass" />;

  if (stale) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold">This Pass changed.</h1>
        <p className="mt-2 text-neutral-700">
          The trade parameters you reviewed are no longer current.
        </p>
        <div className="mt-5">
          <Link
            href={`/p/${publicId}`}
            className="inline-flex min-h-[44px] items-center rounded border border-neutral-900 bg-neutral-900 px-4 py-2 font-medium text-white no-underline"
          >
            Review latest Pass
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Step {step + 1} / 4 · {STEPS[step]}
        </p>
        <h1 className="mt-2 font-mono text-3xl font-semibold">
          {pass?.asset} {pass?.direction.toUpperCase()}
        </h1>
        {pass && <StatusChip label={statusLabel(pass.status)} />}
      </header>

      {error && <ErrorBlock title="Cannot continue" body={error} />}

      {step === 0 && (
        <Panel title="Your position size">
          <p className="text-sm text-neutral-600">
            You choose how much to deploy. The Trader&apos;s plan is context, not
            an instruction.
          </p>
          {accounts.length === 0 ? (
            <div className="mt-4">
              <ErrorBlock
                title="No Hyperliquid account linked"
                body="Link your Hyperliquid account address before taking a Pass."
              />
              <div className="mt-3">
                <Link href="/settings" className="text-sm">
                  Go to settings
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-4">
                {accounts.length > 1 && (
                  <Field label="Trading account" htmlFor="account">
                    <select
                      id="account"
                      className={monoInputClass}
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {truncateAddress(a.accountAddress)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field
                  label="Position size (your own)"
                  htmlFor="size"
                  helper="This value is never taken from the Trader."
                >
                  <input
                    id="size"
                    inputMode="decimal"
                    className={monoInputClass}
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-5">
                <Button
                  variant="primary"
                  size="lg"
                  disabled={busy || !size || !accountId}
                  onClick={review}
                >
                  Continue to review
                </Button>
              </div>
            </>
          )}
        </Panel>
      )}

      {step === 1 && preview && (
        <Panel title="Order summary">
          <dl className="grid grid-cols-2 gap-4 font-mono">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Pass version</dt>
              <dd className="mt-1 text-xl">{preview.passVersion}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Size</dt>
              <dd className="mt-1 text-xl">{preview.positionSize}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Entry</dt>
              <dd className="mt-1 text-xl">{fmtPrice(preview.requestedEntry)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Market</dt>
              <dd className="mt-1 text-xl">{fmtPrice(preview.markPrice)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">TP</dt>
              <dd className="mt-1 text-xl">{fmtPrice(preview.takeProfit)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">SL</dt>
              <dd className="mt-1 text-xl">{fmtPrice(preview.stopLoss)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Leverage</dt>
              <dd className="mt-1 text-xl">{preview.leverage ?? "—"}x</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Est. margin</dt>
              <dd className="mt-1 text-xl">{fmtPrice(preview.estimatedMargin)}</dd>
            </div>
          </dl>
          <p className="mt-3 font-mono text-xs text-neutral-500">
            Market read {fmtUtc(preview.marketObservedAt)} · slippage tolerance{" "}
            {preview.slippageToleranceBps} bps
          </p>

          {preview.warnings.length > 0 && (
            <>
              <Rule />
              <ul className="mt-3 flex flex-col gap-2">
                {preview.warnings.map((w) => (
                  <li key={w.code} className="text-sm text-amber-800">
                    {w.message}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" onClick={() => setStep(2)}>
              Authorize
            </Button>
            <Button size="lg" onClick={() => setStep(0)}>
              Change size
            </Button>
          </div>
        </Panel>
      )}

      {step === 2 && preview && (
        <Panel title="Authorization">
          <p className="text-neutral-800">
            You are authorizing your own order on Hyperliquid for{" "}
            <strong className="font-mono">{preview.positionSize}</strong> of{" "}
            <strong>{pass?.asset}</strong> {pass?.direction === "long" ? "long" : "short"}
            {preview.leverage ? ` at ${preview.leverage}x leverage` : ""}.
          </p>
          <Rule />
          <ul className="mt-3 flex flex-col gap-2 text-sm text-neutral-700">
            <li>The order is signed in your browser and relayed by the PASS API.</li>
            <li>PASS never receives or stores a private key.</li>
            <li>Your account pays fees and holds the resulting position.</li>
            <li>Prices can move and the order may be rejected.</li>
          </ul>
          <div className="mt-5">
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={authorize}
            >
              {busy ? "Submitting…" : "Authorize and execute"}
            </Button>
          </div>
          {mode === "mock" && (
            <p className="mt-3 text-xs text-amber-800">
              Provider is running in mock mode. This will not place a real order.
            </p>
          )}
        </Panel>
      )}

      {step === 3 && result && (
        <Panel title="Order submitted">
          <dl className="grid gap-4 font-mono">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">
                Provider order id
              </dt>
              <dd className="mt-1 break-all text-xl">{result.providerOrderId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Status</dt>
              <dd className="mt-1 text-xl">{result.status}</dd>
            </div>
          </dl>
          <Rule />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/p/${publicId}`}
              className="inline-flex min-h-[44px] items-center rounded border border-neutral-300 bg-white px-4 py-2 text-sm no-underline"
            >
              View Pass
            </Link>
            <Link
              href="/me/executions"
              className="inline-flex min-h-[44px] items-center rounded border border-neutral-300 bg-white px-4 py-2 text-sm no-underline"
            >
              View executions
            </Link>
          </div>
        </Panel>
      )}
    </div>
  );
}