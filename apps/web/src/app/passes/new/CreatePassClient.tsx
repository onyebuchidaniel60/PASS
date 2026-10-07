"use client";

/**
 * Create Pass — design/DESIGN.md §10.5, docs/UX_SPEC.md §7.
 *
 * A Trader authors a structured trade plan. Single page, progressive, with the
 * object always in view.
 *
 * Field order is UX_SPEC §7's and is binding: Asset, Direction, Entry type,
 * Entry price, Stop loss, Take profit, Leverage, Thesis, Expiry.
 *
 * §10.5 / §7 validation is LIVE and TEXTUAL: price ordering, supported market,
 * leverage bounds, expiry validity, and TP/SL direction consistency. Each error
 * sits under its field, is announced through Field's aria-describedby, and is
 * never signalled by border colour alone (§2.8).
 *
 * D-015: there is NO Taker-size field here. A Trader publishes a plan, not a
 * size instruction. Adding one would be a product-behaviour change.
 *
 * Publish is disabled WITH AN INLINE REASON until the form is valid, which is
 * why Button carries `disabledReason`.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
} from "@/components/wave1/signature";
import {
  Button,
  Field,
  LeverageStepper,
  NumericInput,
  SegmentedControl,
  Select,
  Textarea,
  TextInput,
  ValidationMessage,
  type SegmentedOption,
} from "@/components/wave2/controls";
import {
  ErrorBlock,
  LoadingBlock,
  PermissionBlock,
} from "@/components/wave3/data";

import { clientGet, clientPost } from "@/lib/client";

interface Market {
  asset: string;
  dex: string;
  maxLeverage: number;
}

const DIRECTIONS: readonly SegmentedOption<"long" | "short">[] = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

const ENTRY_TYPES: readonly SegmentedOption<"limit" | "market">[] = [
  { value: "limit", label: "Limit" },
  { value: "market", label: "Market" },
];

/** One validation result per field. Absent key means the field is valid. */
type Errors = Partial<
  Record<"entry" | "sl" | "tp" | "leverage" | "expiry", string>
>;

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Live validation. Returns per-field messages rather than a single boolean so
 * each error can sit under its own control and be announced by name.
 */
export function validate(p: {
  asset: string;
  direction: "long" | "short";
  entryType: "limit" | "market";
  entry: string;
  sl: string;
  tp: string;
  leverage: number;
  expiry: string;
  markets: Market[];
}): Errors {
  const e: Errors = {};
  const entry = num(p.entry);
  const sl = num(p.sl);
  const tp = num(p.tp);

  if (!p.markets.some((m) => m.asset === p.asset)) {
    e.entry = "That market is not supported.";
  } else if (p.entryType === "limit" && entry === null) {
    e.entry = "Enter an entry price.";
  }

  if (sl === null) {
    e.sl = "Enter a stop loss.";
  } else if (entry !== null) {
    // TP/SL must be on the correct side of entry for the direction. §7
    // "TP/SL direction consistency".
    if (p.direction === "long" && sl >= entry) {
      e.sl = "For a long Pass the stop must be below the entry.";
    }
    if (p.direction === "short" && sl <= entry) {
      e.sl = "For a short Pass the stop must be above the entry.";
    }
  }

  if (tp === null) {
    e.tp = "Enter a take profit.";
  } else if (entry !== null) {
    if (p.direction === "long" && tp <= entry) {
      e.tp = "For a long Pass the target must be above the entry.";
    }
    if (p.direction === "short" && tp >= entry) {
      e.tp = "For a short Pass the target must be below the entry.";
    }
  }

  const market = p.markets.find((m) => m.asset === p.asset);
  if (market && p.leverage > market.maxLeverage) {
    e.leverage = `Maximum leverage for ${p.asset} is ${market.maxLeverage}x.`;
  }

  if (!p.expiry) {
    e.expiry = "Set an expiry.";
  } else {
    const when = new Date(p.expiry).getTime();
    if (!Number.isFinite(when)) {
      e.expiry = "That is not a valid time.";
    } else if (when <= Date.now()) {
      e.expiry = "The expiry must be in the future.";
    }
  }

  return e;
}

export function CreatePassClient() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  const [booting, setBooting] = useState(true);

  const [asset, setAsset] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entryType, setEntryType] = useState<"limit" | "market">("limit");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [leverage, setLeverage] = useState(5);
  const [thesis, setThesis] = useState("");
  const [expiry, setExpiry] = useState("");

  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const boot = useCallback(async () => {
    setBooting(true);
    // The provisional form did not gate on auth; it let POST /api/v1/passes
    // 401 after the form was filled. Checking first means an unauthenticated
    // visitor is told WHY before they do any work (§9.7 PermissionBlock).
    try {
      await clientGet("/api/v1/me");
      setAuth("in");
    } catch {
      setAuth("out");
    }
    try {
      const m = await clientGet<{ assets?: Market[] }>("/api/v1/markets");
      const list = m.assets ?? [];
      setMarkets(list);
      if (list[0]) setAsset(list[0].asset);
    } catch {
      // Markets are needed for validation. Without them the form cannot be
      // validated, so this is an error state rather than a silent empty list.
      setFailed("Could not load supported markets.");
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  const errors = useMemo(
    () =>
      validate({ asset, direction, entryType, entry, sl, tp, leverage, expiry, markets }),
    [asset, direction, entryType, entry, sl, tp, leverage, expiry, markets],
  );

  const blocking = Object.keys(errors).length > 0 || !thesis.trim() || !asset;
  const valid = !blocking;

  async function publish() {
    setBusy(true);
    setFailed(null);
    try {
      const created = await clientPost<{ publicId?: string }>("/api/v1/passes", {
        asset,
        direction,
        entryType,
        entryPrice: entry,
        stopLoss: sl,
        takeProfit: tp,
        leverage: String(leverage),
        thesis,
        expiresAt: new Date(expiry).toISOString(),
      });
      setPublished(created.publicId ?? null);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Could not publish the Pass.");
    } finally {
      setBusy(false);
    }
  }

  if (published) {
    return (
      <PageShell>
        <ShellContent>
          <Section label="Published">
            <h1 className="pass-asset-line">Pass published</h1>
            <p className="pass-thesis" style={{ marginBlockStart: "var(--space-4)" }}>
              Your plan is live. Share it, or keep authoring.
            </p>
            <Inline gap="4" style={{ marginBlockStart: "var(--space-5)" }}>
              {published ? (
                <Link href={`/p/${published}`} className="pass-link-btn">
                  View Pass
                </Link>
              ) : null}
              <Link href="/me/passes" className="pass-link-btn">
                My Passes
              </Link>
              <Link href="/passes/new" className="pass-link-btn">
                Create another
              </Link>
            </Inline>
          </Section>
        </ShellContent>
      </PageShell>
    );
  }

  if (auth === "out") {
    return (
      <PageShell>
        <ShellContent>
          <PermissionBlock
            reason="Publishing a Pass requires a connected X identity. Connect to author a plan."
            action={
              <Link href="/" className="pass-link-btn">
                Go to the start
              </Link>
            }
          />
        </ShellContent>
      </PageShell>
    );
  }

  if (booting || auth === "checking") {
    return (
      <PageShell>
        <ShellContent>
          <LoadingBlock label="Preparing the form" rows={4} />
        </ShellContent>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ShellContent>
        <Stack gap="6">
          <Section label="Create a Pass">
            <h1 className="pass-asset-line">Create a Pass</h1>
            <p className="pass-thesis" style={{ marginBlockStart: "var(--space-3)" }}>
              A Trader publishes a plan, not a size instruction. Takers choose
              their own size.
            </p>
          </Section>

          {failed ? <ErrorBlock detail={failed} onRetry={boot} /> : null}

          {/* §10.5 — the live preview, the same primitives as the Pass page. */}
          <ChamferPanel label="Pass preview">
            <CoordinateGrid>
              <CoordinatePair label="Asset" value={asset || "—"} />
              <CoordinatePair label="Direction" value={direction === "long" ? "Long" : "Short"} />
              <CoordinatePair label="Entry" value={entry || "—"} />
              <CoordinatePair label="TP" value={tp || "—"} />
              <CoordinatePair label="SL" value={sl || "—"} />
              <CoordinatePair label="Leverage" value={`${leverage}x`} />
            </CoordinateGrid>
          </ChamferPanel>

          <Stack gap="5">
            <Field label="Asset" required>
              {({ controlId }) => (
                <Select
                  id={controlId}
                  value={asset}
                  onChange={setAsset}
                  options={markets.map((m) => ({
                    value: m.asset,
                    label: `${m.asset}-${m.dex.toUpperCase()}`,
                  }))}
                />
              )}
            </Field>

            <Field label="Direction" required>
              {({ controlId }) => (
                <SegmentedControl
                  options={DIRECTIONS}
                  value={direction}
                  onChange={setDirection}
                  label="Direction"
                />
              )}
            </Field>

            <Field label="Entry type" required>
              {({ controlId }) => (
                <SegmentedControl
                  options={ENTRY_TYPES}
                  value={entryType}
                  onChange={setEntryType}
                  label="Entry type"
                />
              )}
            </Field>

            <Field
              label="Entry price"
              required={entryType === "limit"}
              error={errors.entry}
              helper={entryType === "market" ? "Market entry uses the current price." : undefined}
            >
              {({ controlId, describedBy }) => (
                <NumericInput
                  id={controlId}
                  value={entry}
                  onChange={setEntry}
                  describedBy={describedBy}
                  invalid={Boolean(errors.entry)}
                  placeholder="0.00"
                  suffix="USDC"
                />
              )}
            </Field>

            <Field label="Stop loss" required error={errors.sl}>
              {({ controlId, describedBy }) => (
                <NumericInput
                  id={controlId}
                  value={sl}
                  onChange={setSl}
                  describedBy={describedBy}
                  invalid={Boolean(errors.sl)}
                  placeholder="0.00"
                  suffix="USDC"
                />
              )}
            </Field>

            <Field label="Take profit" required error={errors.tp}>
              {({ controlId, describedBy }) => (
                <NumericInput
                  id={controlId}
                  value={tp}
                  onChange={setTp}
                  describedBy={describedBy}
                  invalid={Boolean(errors.tp)}
                  placeholder="0.00"
                  suffix="USDC"
                />
              )}
            </Field>

            <Field label="Leverage" required error={errors.leverage} helper="Permitted range shown.">
              {({ controlId, describedBy }) => (
                <LeverageStepper
                  id={controlId}
                  value={leverage}
                  onChange={setLeverage}
                  min={1}
                  max={20}
                  describedBy={describedBy}
                />
              )}
            </Field>

            <Field label="Thesis" required helper="Say why. The Taker reads this first.">
              {({ controlId, describedBy }) => (
                <Textarea
                  id={controlId}
                  value={thesis}
                  onChange={setThesis}
                  describedBy={describedBy}
                  rows={5}
                />
              )}
            </Field>

            <Field label="Expiry" required error={errors.expiry}>
              {({ controlId, describedBy }) => (
                <TextInput
                  id={controlId}
                  value={expiry}
                  onChange={setExpiry}
                  describedBy={describedBy}
                  invalid={Boolean(errors.expiry)}
                  placeholder="2026-10-07T14:22"
                />
              )}
            </Field>
          </Stack>

          {/* §10.5 — Publish is disabled WITH AN INLINE REASON until valid. */}
          <Inline gap="3">
            <Button
              variant="primary"
              size="lg"
              onClick={publish}
              disabledReason={
                busy
                  ? "Publishing…"
                  : valid
                    ? undefined
                    : "Complete the required fields and clear the messages above."
              }
            >
              Publish
            </Button>
            <Link href="/" className="pass-link-btn">
              Cancel
            </Link>
          </Inline>

          {/* Aggregate, announced, so the reason is reachable without hunting. */}
          {Object.keys(errors).length ? (
            <div role="status" aria-live="polite">
              <ValidationMessage>
                {Object.keys(errors).length} field
                {Object.keys(errors).length === 1 ? "" : "s"} need attention before
                this Pass can be published.
              </ValidationMessage>
            </div>
          ) : null}
        </Stack>
      </ShellContent>
    </PageShell>
  );
}