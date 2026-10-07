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
 */

import Link from "next/link";
import { useCallback, useState } from "react";

import {
  ChamferPanel,
  Inline,
  PageShell,
  Section,
  ShellContent,
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
  RejectedBlock,
  StatusChip,
} from "@/components/wave3/data";

import { clientPost } from "@/lib/client";

type Step = 1 | 2 | 3 | 4;

interface PassView {
  publicId: string;
  asset: string;
  direction: "long" | "short";
  status: string;
  entryPrice: string;
  takeProfit: string;
  stopLoss: string;
  leverage: string;
  market?: { markPrice: string; observedAt: string } | null;
}

interface Preview {
  warnings?: string[];
  estimatedMargin?: number;
  slippageTolerance?: number;
  passVersion?: number;
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
    setBusy(true);
    setFailed(null);
    try {
      const p = await clientPost<Preview>(
        `/api/v1/passes/${publicId}/execution-preview`,
        { sizeUsd: n, leverage },
      );
      setPreview(p);
      goto(2);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function authorize() {
    setBusy(true);
    setFailed(null);
    setRejected(null);
    try {
      const r = await clientPost<{ orderId?: string; status?: string }>(
        `/api/v1/passes/${publicId}/executions`,
        { sizeUsd: Number(size), leverage, signedAction: "demo" },
      );
      setReceipt(r);
      goto(4);
    } catch (e) {
      // A provider rejection is first-class and carries the provider's reason
      // (§10.6 Step 4). It is NOT the same thing as a validation failure.
      setRejected(e instanceof Error ? e.message : "Rejected.");
    } finally {
      setBusy(false);
    }
  }

  const asset = initialPass.asset;
  const long = initialPass.direction === "long";

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          <Section label={`Step ${step} of 4`}>
            <p className="pass-stale">{`STEP ${step} / 4`}</p>
            <h1 className="pass-asset-line" style={{ marginBlockStart: "var(--space-2)" }}>
              {STEP_TITLE[step]}
            </h1>
            <Inline gap="3" style={{ marginBlockStart: "var(--space-3)" }}>
              <span className="pass-value">{asset}</span>
              <span className="pass-chip" data-state="active">
                {long ? "Long" : "Short"}
              </span>
              <StatusChip state={initialPass.status as never} />
            </Inline>
          </Section>

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
                    <CoordinatePair label="TP" value={fmt(initialPass.takeProfit)} />
                    <CoordinatePair label="SL" value={fmt(initialPass.stopLoss)} />
                    <CoordinatePair
                      label="Slippage"
                      value={
                        preview?.slippageTolerance === undefined
                          ? "—"
                          : `${preview.slippageTolerance}%`
                      }
                    />
                    <CoordinatePair
                      label="Est. margin"
                      value={
                        preview?.estimatedMargin === undefined
                          ? "—"
                          : `${fmt(preview.estimatedMargin)} USDC`
                      }
                    />
                  </CoordinateGrid>

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
                    <ValidationMessage key={w}>{w}</ValidationMessage>
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
        </Stack>
      </ShellContent>
    </PageShell>
  );
}