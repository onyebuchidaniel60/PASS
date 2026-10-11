"use client";

/**
 * Take flow — design/DESIGN.md §10.6, docs/UX_SPEC.md §8.
 *
 * A document being signed, not a checkout.
 *
 * Four steps, each with its own title. Progress is MONO TEXT ("STEP 2 / 4"),
 * never a novelty stepper (§10.6).
 *
 * Rules encoded here:
 *  - D-015 / §10.6 Step 1: the size field is EMPTY by default and is never
 *    seeded from the Trader's size. The Taker authors their own execution.
 *  - §10.6 Step 3: a plain-language statement of what will happen ABOVE any
 *    control, naming wallet, market, size, and that the Taker authorizes their
 *    own order. No pre-ticked consent, no countdown.
 *  - §12.4: no "Are you sure?" modal, no persuasion.
 *
 * Pipeline: POST /api/v1/passes/{id}/execution-preview, then
 * POST /api/v1/passes/{id}/executions. Both auth-gated.
 *
 * Stage F wiring (D-025): the preview carries the reviewed Pass version and
 * the taker's account; authorize builds the bracket order with
 * `buildOrderAction` (entry + reduce-only TP/SL, grouping normalTpsl),
 * signs it with the client-held agent key, and posts the real signed
 * payload. `signedAction: "demo"` is gone from every path. The wallet
 * connects lazily here at Take time (D-023), never earlier; a missing
 * agent approval runs as a first-execution step (D-019.1).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import { ConnectKitButton } from "connectkit";

import {
  ChamferPanel,
  Inline,
  Stack,
} from "@/components/wave1/layout";
import {
  CoordinateGrid,
  CoordinatePair,
  SignalLine,
} from "@/components/wave1/signature";
import {
  Button,
  Checkbox,
  Field,
  LeverageStepper,
  NumericInput,
  ValidationMessage,
} from "@/components/wave2/controls";
import {
  ErrorBlock,
  LoadingBlock,
  PermissionBlock,
  RejectedBlock,
  StatusChip,
} from "@/components/wave3/data";
import { SignInXButton } from "@/components/SignInX";

import { Surface } from "@/components/reference";
import { clientGet, clientPost } from "@/lib/client";
import type { MePayload, MeTradingAccount } from "@/lib/me";
import { hasAgentKeyInMemory } from "@/lib/agent-keystore";
import { runApproveAgent } from "@/lib/approve-agent";
import { buildExchangeRequest, signExchangeRequest } from "@/lib/signer";
import {
  entrySourceLabel,
  executionBody,
  floorBaseSize,
  newClientRequestId,
  resolveEntryPrice,
} from "@/lib/take-order";

type Step = 1 | 2 | 3 | 4;

interface PassView {
  publicId: string;
  asset: string;
  direction: "long" | "short";
  entryType: "limit" | "market";
  version: number;
  status: string;
  entryPrice: string;
  takeProfit: string;
  stopLoss: string;
  leverage: string;
  market?: { markPrice: string; observedAt: string } | null;
}

/** Server ExecutionPreviewDto, as documented in API_CONTRACTS §8. */
interface Preview {
  passVersion: number;
  passPublicId?: string;
  requestedEntry?: string | null;
  markPrice?: string | null;
  positionSize?: string;
  leverage?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
  slippageToleranceBps?: number;
  estimatedMargin?: string | null;
  availableMargin?: string | null;
  warnings?: { code: string; message: string }[];
  requiresConfirmation?: boolean;
}

interface MarketMeta {
  asset: string;
  assetId: number;
  szDecimals: number;
  maxLeverage: number;
}

interface Health {
  modes?: { hyperliquidExecution?: "live" | "mock"; hyperliquid?: "live" | "mock" };
}

const STEP_TITLE: Record<Step, string> = {
  1: "Choose your size",
  2: "Execution preview",
  3: "Authorization",
  4: "Confirmation",
};

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const [w, f] = String(v).split(".");
  return `${w.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${f ? `.${f}` : ""}`;
}

export function TakeFlowClient({
  publicId,
  initialPass,
}: {
  publicId: string;
  initialPass: PassView;
}) {
  const [step, setStep] = useState<Step>(1);
  const [leverage, setLeverage] = useState(Number(initialPass.leverage) || 5);
  // EMPTY by default. Never seeded from the Trader's size (D-015).
  const [size, setSize] = useState("");
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ orderId?: string; status?: string } | null>(
    null,
  );

  // Stage F session: the market's asset meta (index + szDecimals for
  // D-025.2) and the deployed execution mode. The linked account row is
  // always re-read fresh where it is needed, never cached.
  const [boot, setBoot] = useState<"loading" | "ready" | "denied">("loading");
  const [assetMeta, setAssetMeta] = useState<MarketMeta | null>(null);
  const [execMode, setExecMode] = useState<"live" | "mock">("mock");
  // Lazy wallet (D-023): when an action needs the browser wallet and it is
  // not connected, the flow parks here and resumes after connect.
  const [needWallet, setNeedWallet] = useState(false);
  const [pending, setPending] = useState<"preview" | "authorize" | null>(null);
  const [agentNote, setAgentNote] = useState<string | null>(null);

  const { address, isConnected: browserConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // /me first: any failure means signed-out, and the flow gates on it.
        const [, markets, health] = await Promise.all([
          clientGet<MePayload>("/api/v1/me"),
          clientGet<{ assets?: MarketMeta[] }>("/api/v1/markets"),
          clientGet<Health>("/health"),
        ]);
        if (cancelled) return;
        // The linked row is re-read fresh at preview/authorize time, so
        // boot only verifies the session; nothing account-like is cached.
        const meta =
          (markets.assets ?? []).find(
            (a) => a.asset.toUpperCase() === initialPass.asset.toUpperCase(),
          ) ?? null;
        setAssetMeta(meta);
        // Anything but an explicit live flag signs the mock envelope. Both
        // mis-signings fail safe at the relay (ORDER_REJECTED, no funds move).
        setExecMode(health.modes?.hyperliquidExecution === "live" ? "live" : "mock");
        setBoot("ready");
      } catch {
        if (!cancelled) setBoot("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPass.asset]);

  /** Fresh /me, returning the primary (else first) trading account row. */
  async function refreshAccount(): Promise<MeTradingAccount | null> {
    const me = await clientGet<MePayload>("/api/v1/me");
    const list = me.tradingAccounts ?? [];
    return list.find((a) => a.isPrimary) ?? list[0] ?? null;
  }

  /**
   * Take-time account linking (D-023): the connected wallet address must
   * have a PASS trading-account row before preview or authorize can run.
   * Returns the row, or null when the wallet still needs connecting (the
   * caller parks and resumes after connect in that case).
   */
  async function ensureLinkedAccount(): Promise<MeTradingAccount | null> {
    if (!browserConnected || !address) return null;
    const me = await clientGet<MePayload>("/api/v1/me");
    const found =
      (me.tradingAccounts ?? []).find(
        (a) => a.accountAddress.toLowerCase() === address.toLowerCase(),
      ) ?? null;
    if (found) return found;
    await clientPost("/api/v1/me/trading-accounts", { accountAddress: address });
    return refreshAccount();
  }

  /**
   * The single numbers computation. Step 2 displays it and authorize()
   * signs it — preview and submit cannot disagree because there is only
   * one of it.
   */
  function takeNumbers():
    | { entryPrice: string; baseSize: string; assetIndex: number }
    | { error: string } {
    if (!assetMeta) return { error: "Market data is unavailable for this asset." };
    const mid = preview?.markPrice ?? initialPass.market?.markPrice ?? null;
    const entryPrice = resolveEntryPrice({
      entryType: initialPass.entryType ?? "limit",
      entryPrice: initialPass.entryPrice ?? null,
      midPrice: mid,
    });
    if (!entryPrice) {
      return {
        error:
          (initialPass.entryType ?? "limit") === "limit"
            ? "This Pass has no entry price to sign."
            : "No market price is available for a market entry right now.",
      };
    }
    const n = Number(size);
    const baseSize = floorBaseSize(n, entryPrice, assetMeta.szDecimals);
    if (!baseSize) {
      return { error: "That size is too small to place on this market." };
    }
    return { entryPrice, baseSize, assetIndex: assetMeta.assetId };
  }

  const goto = useCallback((next: Step) => {
    setStep(next);
    setFailed(null);
    setRejected(null);
    // Each step is its own view, so scroll must not carry over. Guarded: some
    // hosts have no scrollTo, and an unguarded call interrupts the transition
    // rather than merely skipping the scroll.
    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      try {
        window.scrollTo(0, 0);
      } catch {
        // A host that cannot scroll is not a failure of the flow.
      }
    }
  }, []);

  async function submitPreview() {
    const n = Number(size);
    if (!size.trim() || !Number.isFinite(n) || n <= 0) {
      setSizeError("Enter a position size greater than zero.");
      return;
    }
    setSizeError(null);
    // Lazy wallet first: the preview needs a linked account, which needs
    // the connected address. Park and resume after connect when absent.
    if (!browserConnected || !address) {
      setPending("preview");
      setNeedWallet(true);
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      const row = await ensureLinkedAccount();
      if (!row) {
        setPending("preview");
        setNeedWallet(true);
        return;
      }
      const p = await clientPost<Preview>(
        `/api/v1/passes/${publicId}/execution-preview`,
        {
          passVersion: initialPass.version,
          accountId: row.id,
          positionSize: size.trim(),
          leverage: String(leverage),
          slippageToleranceBps: 50,
        },
      );
      setPreview(p);
      goto(2);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * First-execution agent approval (D-019.1): the master wallet signs
   * approveAgent, the agent key signs everything after. Skipped whenever
   * this browser already holds the approved key.
   */
  async function ensureAgent(row: MeTradingAccount): Promise<boolean> {
    if (row.agentAddress && hasAgentKeyInMemory()) return true;
    if (!browserConnected || !address) return false;
    setAgentNote("Approving the agent wallet — your master wallet signs once.");
    try {
      const done = await runApproveAgent({
        accountId: row.id,
        address,
        signMessageAsync: (args) => signMessageAsync(args),
        signTypedDataAsync: (args) => signTypedDataAsync(args as never),
        postApprove: (id, body) =>
          clientPost<{ agentAddress: string; mode: string }>(
            `/api/v1/me/trading-accounts/${id}/approve-agent`,
            body as Record<string, unknown>,
          ),
      });
      setAgentNote(
        done.persisted
          ? null
          : (done.warning ?? "Agent approved for this session."),
      );
      const fresh = await refreshAccount();
      return Boolean(fresh && fresh.agentAddress && hasAgentKeyInMemory());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Agent approval failed.";
      setAgentNote(null);
      setFailed(
        /rejected|denied|cancell?ed/i.test(msg)
          ? "You cancelled the wallet signature. No agent was approved and nothing was submitted."
          : msg,
      );
      return false;
    }
  }

  async function authorize() {
    setBusy(true);
    setFailed(null);
    setRejected(null);
    setAgentNote(null);
    try {
      if (!browserConnected || !address) {
        setPending("authorize");
        setNeedWallet(true);
        return;
      }
      const row = await ensureLinkedAccount();
      if (!row) {
        setPending("authorize");
        setNeedWallet(true);
        return;
      }
      if (!(await ensureAgent(row))) return;
      // D-025: the same numbers the preview displayed, signed, not demoed.
      const nums = takeNumbers();
      if ("error" in nums) {
        setFailed(nums.error);
        return;
      }
      const request = buildExchangeRequest({
        assetIndex: nums.assetIndex,
        isBuy: long,
        size: nums.baseSize,
        limitPx: nums.entryPrice,
        takeProfit: initialPass.takeProfit ?? null,
        stopLoss: initialPass.stopLoss ?? null,
      });
      // Live mode without a key throws here; nothing is sent (fail closed).
      const signed = await signExchangeRequest(execMode, request);
      const r = await clientPost<{ executionId?: string; providerOrderId?: string; status?: string }>(
        `/api/v1/passes/${publicId}/executions`,
        executionBody({
          passVersion: preview?.passVersion ?? initialPass.version,
          accountId: row.id,
          clientRequestId: newClientRequestId(),
          signedPayload: {
            exchangeRequest: signed.exchangeRequest,
            signature: signed.signature,
          },
        }),
      );
      setReceipt({ orderId: r.providerOrderId, status: r.status });
      goto(4);
    } catch (e) {
      // A provider rejection is first-class and carries the provider's reason
      // (§10.6 Step 4). It is NOT the same thing as a validation failure.
      const msg = e instanceof Error ? e.message : "Rejected.";
      const code = (e as { code?: string }).code;
      setRejected(code ? `${code}: ${msg}` : msg);
    } finally {
      setBusy(false);
    }
  }

  // Resume after a lazy wallet connect (D-023): the parked action reruns
  // with the wallet now present.
  useEffect(() => {
    if (!browserConnected || !needWallet || !pending || busy) return;
    setNeedWallet(false);
    const next = pending;
    setPending(null);
    if (next === "preview") void submitPreview();
    else void authorize();
    // submitPreview/authorize close over current render state; rerunning
    // them from this effect is the resume, not a loop (pending clears).
  }, [browserConnected]);

  const asset = initialPass.asset;
  const long = initialPass.direction === "long";
  const entryType = initialPass.entryType ?? "limit";
  // Displayed in steps 2–3; authorize() signs exactly this (D-025).
  const nums = preview ? takeNumbers() : null;

  // Lazy-wallet gate (D-023): the same launcher everywhere, PASS chrome.
  // No injected provider at all means the modal cannot succeed, so say so
  // specifically instead of opening ConnectKit's generic error screen.
  const hasInjectedWallet =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { ethereum?: unknown }).ethereum);
  const walletGate = !hasInjectedWallet ? (
    <Stack gap="3">
      <p className="pass-thesis">
        No browser wallet was found. Install a wallet extension (MetaMask,
        Rabby, Coinbase or Brave), reload this page, and continue — the
        flow resumes where it left off.
      </p>
      <Inline gap="3">
        <Link href={`/p/${publicId}`} className="pass-link-btn">
          Back to Pass
        </Link>
      </Inline>
    </Stack>
  ) : (
    <Stack gap="3">
      <p className="pass-thesis">
        Connect your wallet to continue — the flow resumes where it left
        off. PASS never receives a private key.
      </p>
      <Inline gap="3">
        <ConnectKitButton.Custom>
          {({ show }) => (
            <Button variant="primary" size="lg" onClick={() => show?.()}>
              Connect wallet
            </Button>
          )}
        </ConnectKitButton.Custom>
        <Link href={`/p/${publicId}`} className="pass-link-btn">
          Back to Pass
        </Link>
      </Inline>
    </Stack>
  );

  if (boot === "loading") {
    return (
      <div className="pass-page">
        <div className="pass-shell">
          <main className="pass-shell-content pass-stack pass-stack-6">
            <LoadingBlock label="Preparing the Take flow" rows={3} />
          </main>
        </div>
      </div>
    );
  }

  if (boot === "denied") {
    return (
      <div className="pass-page">
        <div className="pass-shell">
          <main className="pass-shell-content pass-stack pass-stack-6">
            <PermissionBlock
              reason="Taking a Pass needs a connected X identity. Connect to continue."
              action={<SignInXButton />}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    /* §14.1 names this surface specifically: "Executions, My Passes, the Take
       preview, Settings" get the FLAT wash — grain only, no colour behind it.
       A hero-strength wash here would compete with the digits a Taker is being
       asked to authorize, and those digits are the whole point of the screen. */
    <div className="pass-page">
      <Surface strength="flat" grain>
        <div className="pass-shell">
          <main className="pass-shell-content pass-stack pass-stack-6">
          <section className="pass-section" aria-labelledby="take-step-title">
            <span className="pass-numbered-eyebrow">
              <span className="pass-numbered-eyebrow-number">{"//"}</span>
              Take a Pass
            </span>
            {/* §10.6 — progress is MONO TEXT, never a novelty stepper. */}
            <p className="pass-stale">{`STEP ${step} / 4`}</p>
            <h1
              className="pass-display"
              id="take-step-title"
              style={{ marginBlockStart: "var(--space-2)" }}
            >
              {STEP_TITLE[step]}
            </h1>
            <Inline gap="3" style={{ marginBlockStart: "var(--space-3)" }}>
              <span className="pass-value">{asset}</span>
              <span className="pass-chip" data-state="active">
                {long ? "Long" : "Short"}
              </span>
              <StatusChip state={initialPass.status as never} />
            </Inline>
          </section>

          {/* Every behaviour-bearing control below is UNCHANGED by the §14 work:
              the empty size field (D-015), the gated Authorize button, the
              plain-language statement above the checkbox, the verbatim provider
              receipt, and warnings as sentences rather than red borders. Only
              the chrome above and around them changed. */}
          {step === 1 ? (
            <Stack gap="5">
              {/* §10.6 Step 1 — the size field is the first and largest element. */}
              <Field
                label="Position size (USDC)"
                required
                error={sizeError ?? undefined}
                helper="Your size. PASS never chooses one for you."
              >
                {({ controlId, describedBy }) => (
                  <NumericInput
                    id={controlId}
                    value={size}
                    onChange={setSize}
                    describedBy={describedBy}
                    invalid={Boolean(sizeError)}
                    placeholder="0.00"
                    suffix="USDC"
                  />
                )}
              </Field>

              <Field label="Leverage" helper="Permitted range shown.">
                {({ controlId }) => (
                  <LeverageStepper
                    id={controlId}
                    value={leverage}
                    onChange={setLeverage}
                    min={1}
                    max={20}
                  />
                )}
              </Field>

              {/* §10.6 Step 1 item 2 — restate the plan the size is chosen against. */}
              <ChamferPanel label="Pass context">
                <CoordinateGrid>
                  <CoordinatePair label="Entry" value={fmt(initialPass.entryPrice)} />
                  <CoordinatePair label="TP" value={fmt(initialPass.takeProfit)} />
                  <CoordinatePair label="SL" value={fmt(initialPass.stopLoss)} />
                  <CoordinatePair label="Leverage" value={`${leverage}x`} />
                </CoordinateGrid>
              </ChamferPanel>

              {failed ? <ErrorBlock detail={failed} onRetry={submitPreview} /> : null}

              {needWallet ? (
                walletGate
              ) : (
              <Inline gap="3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={submitPreview}
                  disabledReason={busy ? "Requesting preview…" : undefined}
                >
                  Review order
                </Button>
                <Link href={`/p/${publicId}`} className="pass-link-btn">
                  Back to Pass
                </Link>
              </Inline>
              )}
            </Stack>
          ) : null}

          {step === 2 ? (
            <Stack gap="5">
              <ChamferPanel label="Order summary">
                <Stack gap="4">
                  <CoordinateGrid>
                    <CoordinatePair
                      label="Pass version"
                      value={String(preview?.passVersion ?? 1)}
                    />
                    <CoordinatePair label="Asset" value={asset} />
                    <CoordinatePair label="Direction" value={long ? "Long" : "Short"} />
                    {/* Restated EXACTLY as entered. The Taker authorised the
                        number they typed, so re-formatting it here would be
                        authoring a different number. */}
                    <CoordinatePair label="Size" value={`${size} USDC`} />
                    <CoordinatePair label="Leverage" value={`${leverage}x`} />
                    {/* D-025: the signed numbers, shown before they are signed. */}
                    <CoordinatePair
                      label="Entry source"
                      value={
                        nums && !("error" in nums)
                          ? `${entrySourceLabel(entryType)} ${fmt(nums.entryPrice)}`
                          : "—"
                      }
                    />
                    <CoordinatePair
                      label="Base size"
                      value={
                        nums && !("error" in nums)
                          ? `${nums.baseSize} ${asset}`
                          : "—"
                      }
                    />
                    <CoordinatePair label="TP" value={fmt(initialPass.takeProfit)} />
                    <CoordinatePair label="SL" value={fmt(initialPass.stopLoss)} />
                    <CoordinatePair
                      label="Slippage"
                      value={
                        preview?.slippageToleranceBps === undefined
                          ? "—"
                          : `${preview.slippageToleranceBps} bps`
                      }
                    />
                    <CoordinatePair
                      label="Est. margin"
                      value={
                        preview?.estimatedMargin == null
                          ? "—"
                          : `${fmt(preview.estimatedMargin)} USDC`
                      }
                    />
                  </CoordinateGrid>

                  {nums && "error" in nums ? (
                    <ValidationMessage>{nums.error}</ValidationMessage>
                  ) : null}

                  {/* §10.6 Step 2 — authorize against a visible price. */}
                  <SignalLine />
                  <Inline gap="4">
                    <CoordinatePair
                      label="Current price"
                      value={fmt(initialPass.market?.markPrice)}
                    />
                    <span className="pass-stale">
                      {initialPass.market ? "Live" : "Stale"}
                    </span>
                  </Inline>
                </Stack>
              </ChamferPanel>

              {/* §10.6 Step 2 — warnings are plain sentences, not red borders. */}
              {preview?.warnings?.length ? (
                <Stack gap="2">
                  {preview.warnings.map((w) => (
                    <ValidationMessage key={`${w.code}:${w.message}`}>{w.message}</ValidationMessage>
                  ))}
                </Stack>
              ) : null}

              <Inline gap="3">
                <Button variant="primary" size="lg" onClick={() => goto(3)}>
                  Authorize
                </Button>
                <Button variant="ghost" size="lg" onClick={() => goto(1)}>
                  Change size
                </Button>
              </Inline>
            </Stack>
          ) : null}

          {step === 3 ? (
            <Stack gap="5">
              {/* §10.6 Step 3 item 1 — plain language ABOVE any control. */}
              <p className="pass-thesis">
                You are authorizing your own order. You will sign an order for{" "}
                {size} USDC of {asset} at {leverage}x leverage on your own
                Hyperliquid account, with take profit at {fmt(initialPass.takeProfit)}{" "}
                and stop loss at {fmt(initialPass.stopLoss)}. PASS holds no funds
                and cannot move your position. Your wallet signs; PASS relays.
                {nums && !("error" in nums) ? (
                  <>
                    {" "}Entry {entrySourceLabel(entryType).toLowerCase()}{" "}
                    {fmt(nums.entryPrice)}; order size {nums.baseSize} {asset} —
                    the same numbers shown in the preview.
                  </>
                ) : null}
              </p>

              <Stack gap="3">
                <span className="pass-block-heading">// Scope of what is granted \\</span>
                <span className="pass-stale">
                  Connect your Hyperliquid account and approve an agent wallet so
                  this request can be signed. No seed phrase or master private key
                  is requested, displayed, or stored by PASS.
                </span>
                {/* §10.6 Step 3: no pre-ticked consent. */}
                <Checkbox
                  id="consent"
                  checked={consent}
                  onChange={setConsent}
                  label="I have read the order above and authorize it."
                />
              </Stack>

              {failed ? <ErrorBlock detail={failed} onRetry={authorize} /> : null}
              {rejected ? <RejectedBlock reason={rejected} /> : null}
              {agentNote && !failed ? (
                <p role="status" className="pass-note pass-note-status">
                  {agentNote}
                </p>
              ) : null}

              {needWallet ? (
                walletGate
              ) : (
              <Inline gap="3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={authorize}
                  disabledReason={consent ? undefined : "Confirm the statement above first."}
                >
                  Authorize order
                </Button>
                <Button variant="ghost" size="lg" onClick={() => goto(2)}>
                  Back to preview
                </Button>
              </Inline>
              )}
            </Stack>
          ) : null}

          {step === 4 ? (
            <Stack gap="5">
              {busy ? (
                <LoadingBlock label="Submitting" rows={2} />
              ) : (
                <>
                  <ChamferPanel label="Order receipt">
                    <CoordinateGrid>
                      <CoordinatePair
                        label="Provider order id"
                        value={receipt?.orderId ?? "—"}
                      />
                      <CoordinatePair
                        label="Provider status"
                        value={receipt?.status ?? "—"}
                      />
                    </CoordinateGrid>
                  </ChamferPanel>

                  <Inline gap="3">
                    <span className="pass-block-heading">// Pass state \\</span>
                    <StatusChip state={(receipt?.status as never) ?? initialPass.status} />
                  </Inline>

                  {rejected ? <RejectedBlock reason={rejected} /> : null}
                  {failed ? <ErrorBlock detail={failed} onRetry={authorize} /> : null}

                  {/* §10.6 Step 4 item 3 — next actions, never accent. The
                      accent retires once the action has succeeded. */}
                  <Inline gap="4">
                    <Link href={`/p/${publicId}`} className="pass-link-btn">
                      View Pass
                    </Link>
                    <Link href="/me/executions" className="pass-link-btn">
                      View Executions
                    </Link>
                  </Inline>
                </>
              )}
            </Stack>
          ) : null}
          </main>
        </div>
      </Surface>
    </div>
  );
}