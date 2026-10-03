"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  Panel,
  Rule,
  StatusChip,
  inputClass,
  monoInputClass,
} from "@pass/ui";
import { clientGet, clientPatch, clientPost } from "@/lib/client";
import { fmtPrice, statusLabel } from "@/lib/format";

/**
 * docs/UX_SPEC.md §7 — single-page form with live validation and a preview
 * before publishing. The Trader authors a plan; there is no position-size
 * field here because a Trader publishes a plan, not a size (D-015).
 */

interface Market {
  asset: string;
  maxLeverage: number | null;
  midPrice: string | null;
}

const EXPIRY = [
  { label: "1 hour", hours: 1 },
  { label: "4 hours", hours: 4 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

export default function CreatePassPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Market[]>([]);
  const [mode, setMode] = useState<"mock" | "live">("mock");

  const [asset, setAsset] = useState("BTC");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entryType, setEntryType] = useState<"limit" | "market">("limit");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [leverage, setLeverage] = useState("5");
  const [expiryHours, setExpiryHours] = useState(24);
  const [thesis, setThesis] = useState("");

  const [failures, setFailures] = useState<{ field: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; version: number } | null>(null);

  useEffect(() => {
    clientGet<{ mode: string; assets: Market[] }>("/api/v1/markets")
      .then((d) => {
        setAssets(d.assets ?? []);
        setMode(d.mode === "live" ? "live" : "mock");
        if (d.assets?.length && !d.assets.some((a) => a.asset === asset)) {
          setAsset(d.assets[0]!.asset);
        }
      })
      .catch(() => setError("Could not load markets."));
  }, [asset]);

  const selected = useMemo(() => assets.find((a) => a.asset === asset), [assets, asset]);
  const expiresAt = useMemo(
    () => new Date(Date.now() + expiryHours * 3600 * 1000).toISOString(),
    [expiryHours],
  );

  const failureFor = (f: string) => failures.find((x) => x.field === f)?.message ?? null;

  async function validate() {
    const d = await clientPost<{ valid: boolean; failures: { field: string; message: string }[] }>(
      "/api/v1/validate/pass",
      {
        asset,
        direction,
        entryType,
        entryPrice: entryPrice || null,
        stopLoss: stopLoss || null,
        takeProfit: takeProfit || null,
        leverage: leverage || null,
        expiresAt,
      },
    );
    setFailures(d.failures ?? []);
    return d.valid;
  }

  async function createDraft(publish: boolean) {
    setError(null);
    setBusy(true);
    try {
      const ok = await validate();
      if (!ok) {
        setBusy(false);
        return;
      }
      const draft = await clientPost<{ id: string; version: number }>("/api/v1/passes", {
        asset,
        direction,
        entryType,
        entryPrice: entryType === "limit" ? entryPrice : null,
        stopLoss: stopLoss || null,
        takeProfit: takeProfit || null,
        leverage: leverage || null,
        thesis,
        expiresAt,
      });
      setCreated(draft);
      if (publish) {
        await clientPost(`/api/v1/passes/${draft.id}/publish`);
        router.push(`/p/${draft.id}`);
        return;
      }
      await clientPatch(`/api/v1/passes/${draft.id}`, {
        version: draft.version,
        thesis,
        asset,
        direction,
        entryType,
        entryPrice: entryType === "limit" ? entryPrice : null,
        stopLoss: stopLoss || null,
        takeProfit: takeProfit || null,
        leverage: leverage || null,
        expiresAt,
      });
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the Pass.");
      setBusy(false);
    }
  }

  const isLong = direction === "long";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create a Pass</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Publish a structured trade plan. Takers choose their own size.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <Field label="Asset" htmlFor="asset" error={failureFor("asset")}>
          <select
            id="asset"
            className={inputClass}
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            {assets.map((a) => (
              <option key={a.asset} value={a.asset}>
                {a.asset}
                {a.midPrice ? ` — ${fmtPrice(a.midPrice)}` : ""}
              </option>
            ))}
            {assets.length === 0 && <option value="BTC">BTC</option>}
          </select>
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-800">Direction</legend>
          <div className="mt-1 flex gap-2">
            {(["long", "short"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={direction === d}
                onClick={() => setDirection(d)}
                className={`min-h-[44px] rounded border px-4 font-medium ${
                  direction === d
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-800"
                }`}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-800">Entry type</legend>
          <div className="mt-1 flex gap-2">
            {(["limit", "market"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={entryType === t}
                onClick={() => setEntryType(t)}
                className={`min-h-[44px] rounded border px-4 font-medium capitalize ${
                  entryType === t
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        {entryType === "limit" && (
          <Field label="Entry price" htmlFor="entryPrice" error={failureFor("entryPrice")}>
            <input
              id="entryPrice"
              inputMode="decimal"
              className={monoInputClass}
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
            />
          </Field>
        )}

        <Field
          label={`Take profit ${isLong ? "(above entry)" : "(below entry)"}`}
          htmlFor="takeProfit"
          error={failureFor("takeProfit")}
        >
          <input
            id="takeProfit"
            inputMode="decimal"
            className={monoInputClass}
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
          />
        </Field>

        <Field
          label={`Stop loss ${isLong ? "(below entry)" : "(above entry)"}`}
          htmlFor="stopLoss"
          error={failureFor("stopLoss")}
        >
          <input
            id="stopLoss"
            inputMode="decimal"
            className={monoInputClass}
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
          />
        </Field>

        <Field
          label="Leverage"
          htmlFor="leverage"
          error={failureFor("leverage")}
          helper={selected?.maxLeverage ? `Market max ${selected.maxLeverage}x` : undefined}
        >
          <input
            id="leverage"
            inputMode="numeric"
            className={monoInputClass}
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
          />
        </Field>

        <Field label="Expiry" htmlFor="expiry" error={failureFor("expiresAt")}>
          <select
            id="expiry"
            className={inputClass}
            value={expiryHours}
            onChange={(e) => setExpiryHours(Number(e.target.value))}
          >
            {EXPIRY.map((x) => (
              <option key={x.hours} value={x.hours}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Thesis" htmlFor="thesis" error={failureFor("thesis")}>
          <textarea
            id="thesis"
            rows={4}
            className={inputClass}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder="Why this trade?"
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="lg" disabled={busy} onClick={() => createDraft(true)}>
            {busy ? "Working…" : "Publish"}
          </Button>
          <Button size="lg" disabled={busy || !thesis} onClick={() => createDraft(false)}>
            Save draft
          </Button>
        </div>
        {failures.length > 0 && (
          <p className="text-sm text-neutral-600">
            Fix {failures.length} field{failures.length === 1 ? "" : "s"} before
            publishing.
          </p>
        )}
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <Panel title="Preview">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xl font-semibold">
              {asset} {direction.toUpperCase()}
            </span>
            <StatusChip
              label={statusLabel(created ? "draft" : "draft")}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 font-mono">
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Entry</dt>
              <dd className="mt-1 text-xl">
                {entryType === "limit" ? fmtPrice(entryPrice) : "MARKET"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">TP</dt>
              <dd className="mt-1 text-xl">{fmtPrice(takeProfit)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">SL</dt>
              <dd className="mt-1 text-xl">{fmtPrice(stopLoss)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-neutral-500">Leverage</dt>
              <dd className="mt-1 text-xl">{leverage || "—"}x</dd>
            </div>
          </dl>
          <Rule />
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">
            {thesis || "No thesis yet."}
          </p>
          <p className="mt-4 font-mono text-xs text-neutral-500">
            Mode: {mode}
            {mode === "mock" ? " — simulated market data" : ""}
          </p>
        </Panel>
      </div>
    </div>
  );
}