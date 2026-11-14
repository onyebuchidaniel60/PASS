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
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ChamferPanel,
  Inline,
  PageShell,
  Panel,
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
import { SignInXButton } from "@/components/SignInX";

import { MAX_LEVERAGE } from "@pass/contracts";
import { clientGet, clientPatch, clientPost } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import { isXConnected, type MePayload } from "@/lib/me";

interface Market {
  asset: string;
  dex: string;
  maxLeverage?: number | null;
  marketClass?: "perp" | "spot" | "hip4";
  label?: string;
  outcome?: {
    outcomeId: number;
    side: "yes" | "no";
    name: string | null;
    orderCoin: string;
    balanceCoin: string;
    assetId: number;
  } | null;
}

interface PredictionOutcome {
  id: number;
  name: string;
  yes?: Market;
  no?: Market;
}

function groupPredictionOutcomes(markets: Market[]): PredictionOutcome[] {
  const byId = new Map<number, PredictionOutcome>();
  for (const market of markets) {
    if (market.marketClass !== "hip4" || !market.outcome) continue;
    const current = byId.get(market.outcome.outcomeId) ?? {
      id: market.outcome.outcomeId,
      name: market.outcome.name?.trim() || market.asset,
    };
    if (market.outcome.side === "yes") current.yes = market;
    else current.no = market;
    byId.set(current.id, current);
  }
  return Array.from(byId.values());
}

const PREDICTION_REFERENCE =
  /\n\nPrediction reference: limit ([0-9.]+), size ([0-9.]+) USDH\./;

/** Round-trip the reference line so editing never appends a second copy. */
function splitPredictionReference(value: string): {
  body: string;
  limit: string;
  size: string;
} {
  const match = value.match(PREDICTION_REFERENCE);
  if (!match) return { body: value, limit: "0.50", size: "100" };
  return {
    body: value.slice(0, match.index).trimEnd(),
    limit: match[1] ?? "0.50",
    size: match[2] ?? "100",
  };
}

const DIRECTIONS: readonly SegmentedOption<"long" | "short">[] = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

const OUTCOME_DIRECTIONS: readonly SegmentedOption<"long" | "short">[] = [
  { value: "long", label: "Yes" },
  { value: "short", label: "No" },
];

const ENTRY_TYPES: readonly SegmentedOption<"limit" | "market">[] = [
  { value: "limit", label: "Limit" },
  { value: "market", label: "Market" },
];

/** The form's fields, as a signed-out journey preview (no values invented). */
const CREATE_FIELDS = [
  "Asset",
  "Direction",
  "Entry type",
  "Entry price",
  "Take profit",
  "Stop loss",
  "Leverage",
  "Thesis",
  "Expiry",
];

/** One validation result per field. Absent key means the field is valid. */
type Errors = Partial<
  Record<
    "entry" | "sl" | "tp" | "leverage" | "expiry" | "predictionLimit" | "predictionSize",
    string
  >
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
  marketMode?: "perp" | "prediction";
  predictionLimit?: string;
  predictionSize?: string;
}): Errors {
  const e: Errors = {};
  const entry = num(p.entry);
  const sl = num(p.sl);
  const tp = num(p.tp);
  const market = p.markets.find((m) => m.asset === p.asset);
  const isHip4 = market?.marketClass === "hip4";

  if (!market) {
    e.entry = "That market is not supported.";
  } else if (isHip4) {
    // HIP-4 is market-entry only: no authored price, TP, SL or leverage.
    if (p.entryType !== "market") {
      e.entry = "Outcome Passes must use a market entry.";
    }
  } else if (p.entryType === "limit" && entry === null) {
    e.entry = "Enter an entry price.";
  }

  if (!isHip4) {
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

    // Effective ceiling: the venue's per-asset limit, never above the
    // product-wide MAX_LEVERAGE (single source: @pass/contracts).
    const cap = Math.min(market?.maxLeverage ?? MAX_LEVERAGE, MAX_LEVERAGE);
    if (p.leverage > cap) {
      e.leverage = `Maximum leverage for ${p.asset} is ${cap}x.`;
    }
  }

  if (p.marketMode === "prediction") {
    const limit = num(p.predictionLimit ?? "");
    if (limit === null || limit < 0.01 || limit > 0.99) {
      e.predictionLimit = "Enter a limit probability between 0.01 and 0.99.";
    }
    const size = num(p.predictionSize ?? "");
    if (size === null || size <= 0) {
      e.predictionSize = "Enter a reference size greater than zero.";
    }
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

/** Statuses the author may still edit (server enforces the same set). */
const EDITABLE_STATUSES = new Set(["draft", "active", "entry_pending"]);

/** Empty numeric inputs cross the API as null, never as "". */
function emptyToNull(v: string): string | null {
  return v.trim() === "" ? null : v;
}

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" for the expiry input. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

interface PassDetailForEdit {
  id: string;
  publicId: string;
  version: number;
  status: string;
  asset: string;
  marketClass?: "perp" | "spot" | "hip4" | null;
  direction: "long" | "short";
  entryType: "limit" | "market";
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  leverage: string | null;
  thesis: string;
  expiresAt: string | null;
}

export function CreatePassClient() {
  // Edit mode reuses this form: /passes/new?edit={id}. No separate page.
  const search = useSearchParams();
  const editId = search?.get("edit") ?? null;

  const [markets, setMarkets] = useState<Market[]>([]);
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");
  const [booting, setBooting] = useState(true);

  const [asset, setAsset] = useState("");
  const [marketMode, setMarketMode] = useState<"perp" | "prediction">("perp");
  const [predictionOutcomeId, setPredictionOutcomeId] = useState<number | null>(null);
  const [predictionLimit, setPredictionLimit] = useState("0.50");
  const [predictionSize, setPredictionSize] = useState("100");
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
  // A draft left behind by a failed publish. Retry publishes it instead of
  // minting a second draft.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Edit-mode state.
  const [editVersion, setEditVersion] = useState<number | null>(null);
  const [editPublicId, setEditPublicId] = useState<string | null>(null);
  const [editMarketClass, setEditMarketClass] = useState<"perp" | "spot" | "hip4" | null>(null);
  const [editBlocked, setEditBlocked] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  const boot = useCallback(async () => {
    setBooting(true);
    // Authoring requires a CONNECTED X identity (PRODUCT_PRD.md §4), not
    // merely a session: disconnecting X keeps the PASS session, and the old
    // session-only check rendered the full form to an identity-less user
    // whose submit the API now refuses. The PermissionBlock copy below
    // already said "connected X identity" — the check finally matches it.
    try {
      const me = await clientGet<MePayload>("/api/v1/me");
      setAuth(isXConnected(me) ? "in" : "out");
    } catch {
      setAuth("out");
    }
    let loadedMarkets: Market[] = [];
    try {
      const m = await clientGet<{ assets?: Market[] }>("/api/v1/markets");
      const list = m.assets ?? [];
      loadedMarkets = list;
      setMarkets(list);
      if (list[0] && !editId) setAsset(list[0].asset);
    } catch {
      // Markets are needed for validation. Without them the form cannot be
      // validated, so this is an error state rather than a silent empty list.
      setFailed("Could not load supported markets.");
    }
    if (editId) {
      // Prefill from the author's own pass. Non-authors get the server's
      // 403 here (SECURITY_SPEC §11); the form stays empty and the error
      // names the refusal instead of a blank screen.
      try {
        const d = await clientGet<PassDetailForEdit>(`/api/v1/me/passes/${editId}`);
        if (!EDITABLE_STATUSES.has(d.status)) {
          setEditBlocked(`This Pass is ${d.status} and cannot be edited.`);
        } else {
          setAsset(d.asset);
          setEditMarketClass(d.marketClass ?? "perp");
          const reference = splitPredictionReference(d.thesis ?? "");
          if (d.marketClass === "hip4") {
            const outcomes = groupPredictionOutcomes(loadedMarkets);
            const outcome = outcomes.find(
              (o) => o.yes?.asset === d.asset || o.no?.asset === d.asset,
            );
            setMarketMode("prediction");
            setPredictionOutcomeId(outcome?.id ?? null);
            setPredictionLimit(reference.limit);
            setPredictionSize(reference.size);
          }
          setDirection(d.direction);
          setEntryType(d.entryType);
          setEntry(d.entryPrice ?? "");
          setSl(d.stopLoss ?? "");
          setTp(d.takeProfit ?? "");
          setLeverage(Number(d.leverage ?? "5") || 5);
          setThesis(d.marketClass === "hip4" ? reference.body : (d.thesis ?? ""));
          setExpiry(toLocalInput(d.expiresAt));
          setEditVersion(d.version);
          setEditPublicId(d.publicId);
        }
      } catch (e) {
        setEditBlocked(e instanceof Error ? e.message : "Could not load this Pass.");
      }
    }
    setBooting(false);
  }, [editId]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const perpMarkets = markets.filter((m) => (m.marketClass ?? "perp") === "perp");
  const predictionOutcomes = groupPredictionOutcomes(markets);
  const selectedMarket = markets.find((m) => m.asset === asset) ?? null;
  const predictionOutcome =
    predictionOutcomes.find((o) => o.id === predictionOutcomeId) ?? null;
  const isHip4 = marketMode === "prediction";
  const outcomeName = isHip4
    ? predictionOutcome?.name ?? ""
    : selectedMarket?.outcome?.name?.trim() || selectedMarket?.asset || asset;

  function chooseAsset(next: string) {
    setAsset(next);
  }

  function choosePredictionOutcome(nextId: number) {
    const outcome = predictionOutcomes.find((o) => o.id === nextId) ?? null;
    setPredictionOutcomeId(nextId);
    setAsset(
      direction === "long"
        ? outcome?.yes?.asset ?? outcome?.no?.asset ?? ""
        : outcome?.no?.asset ?? outcome?.yes?.asset ?? "",
    );
  }

  function chooseDirection(next: "long" | "short") {
    setDirection(next);
    if (marketMode === "prediction" && predictionOutcome) {
      setAsset(
        next === "long"
          ? predictionOutcome.yes?.asset ?? predictionOutcome.no?.asset ?? ""
          : predictionOutcome.no?.asset ?? predictionOutcome.yes?.asset ?? "",
      );
    }
  }

  function switchMarketMode(next: "perp" | "prediction") {
    if (next === marketMode) return;
    setMarketMode(next);
    setDirection("long");
    setEntry("");
    setSl("");
    setTp("");
    if (next === "prediction") {
      const first = predictionOutcomes[0] ?? null;
      setPredictionOutcomeId(first?.id ?? null);
      setAsset(first?.yes?.asset ?? first?.no?.asset ?? "");
      setEntryType("market");
    } else {
      setAsset(perpMarkets[0]?.asset ?? "");
      setEntryType("limit");
      setLeverage(5);
    }
  }

  const errors = useMemo(
    () =>
      validate({
        asset,
        direction,
        entryType,
        entry,
        sl,
        tp,
        leverage,
        expiry,
        markets,
        marketMode,
        predictionLimit,
        predictionSize,
      }),
    [
      asset,
      direction,
      entryType,
      entry,
      sl,
      tp,
      leverage,
      expiry,
      markets,
      marketMode,
      predictionLimit,
      predictionSize,
    ],
  );

  const blocking = Object.keys(errors).length > 0 || !thesis.trim() || !asset;
  const valid = !blocking;

  function planBody() {
    const predictionReference =
      isHip4 && predictionLimit && predictionSize
        ? `\n\nPrediction reference: limit ${predictionLimit}, size ${predictionSize} USDH.`
        : "";
    return {
      asset,
      // Explicit class: a `#N` coin is never allowed to be inferred as a perp.
      marketClass: isHip4 ? "hip4" : selectedMarket?.marketClass ?? editMarketClass ?? "perp",
      outcomeName: isHip4 ? predictionOutcome?.name ?? null : null,
      direction,
      entryType: isHip4 ? "market" : entryType,
      // HIP-4 Passes execute at the live probability; the reference limit and
      // size are recorded in the thesis, never sent as a perp entry price.
      entryPrice: isHip4 || entryType === "market" ? null : emptyToNull(entry),
      stopLoss: isHip4 ? null : emptyToNull(sl),
      takeProfit: isHip4 ? null : emptyToNull(tp),
      leverage: isHip4 ? null : String(leverage),
      thesis: `${thesis.trim()}${predictionReference}`.trim(),
      expiresAt: new Date(expiry).toISOString(),
    };
  }

  async function publish() {
    setBusy(true);
    setFailed(null);
    setCopied(false);
    try {
      // Step 1: create the draft (or reuse one left by a failed publish).
      let id = draftId;
      if (!id) {
        const created = await clientPost<{ id?: string; publicId?: string }>(
          "/api/v1/passes",
          planBody(),
        );
        if (!created.id) throw new Error("The server did not return a Pass id.");
        id = created.id;
        setDraftId(id);
      }
      // Step 2: publish it. "Published" is said only after this returns.
      const done = await clientPost<{ publicId?: string }>(
        `/api/v1/passes/${id}/publish`,
      );
      if (!done.publicId) throw new Error("The server did not return a public URL.");
      setDraftId(null);
      setPublished(done.publicId);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setFailed(
        `Publish failed${code ? ` (${code})` : ""}: ${
          e instanceof Error ? e.message : "Could not publish the Pass."
        } Your draft was kept — fix the problem and retry.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editId || editVersion === null) return;
    setBusy(true);
    setFailed(null);
    setSavedVersion(null);
    try {
      // Send the full plan: clears are real (null), not omissions.
      const updated = await clientPatch<{ version?: number }>(
        `/api/v1/passes/${editId}`,
        { ...planBody(), version: editVersion },
      );
      // Refetch so the shown version is the server's, not an assumption.
      // A new pass_versions row exists exactly when an execution-relevant
      // field changed (D-018.5, enforced server-side).
      const fresh = await clientGet<PassDetailForEdit>(`/api/v1/me/passes/${editId}`);
      setEditVersion(fresh.version);
      setSavedVersion(updated.version ?? fresh.version);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setFailed(
        `Save failed${code ? ` (${code})` : ""}: ${
          e instanceof Error ? e.message : "Could not save this Pass."
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setFailed("Copy failed — select the URL and copy it manually.");
    }
  }

  if (published) {
    const path = `/p/${published}`;
    return (
      <PageShell>
        <ShellContent>
          <Section label="Published">
            <h1 className="pass-asset-line">Published</h1>
            <p className="pass-thesis" style={{ marginBlockStart: "var(--space-4)" }}>
              Your plan is live. Share it, or keep authoring.
            </p>
            <Field label="Public URL" helper="Signed-out browsers open this link.">
              {({ controlId }) => (
                <Inline gap="3">
                  <TextInput
                    id={controlId}
                    value={path}
                    onChange={() => {}}
                    placeholder=""
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() =>
                      void copyUrl(`${window.location.origin}${path}`)
                    }
                    disabledReason={undefined}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </Inline>
              )}
            </Field>
            <Inline gap="4" style={{ marginBlockStart: "var(--space-5)" }}>
              {published ? (
                <Link href={path} className="pass-link-btn">
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

  if (editId && editBlocked) {
    // Non-author (server 403) or a Pass past editing. The control is hidden
    // by never rendering the form; the reason names the refusal.
    return (
      <PageShell>
        <ShellContent>
          <PermissionBlock
            reason={`This Pass cannot be edited. ${editBlocked}`}
            action={
              <Link href="/me/passes" className="pass-link-btn">
                Back to My Passes
              </Link>
            }
          />
        </ShellContent>
      </PageShell>
    );
  }

  if (auth === "out") {
    return (
      <PageShell>
        <ShellContent>
          <Section label="Create a Pass">
            <Stack gap="6">
              <Panel className="pass-onboarding-gate">
                <h1>Author a plan.</h1>
                <p className="pass-stale">
                  Publishing a Pass requires a connected X identity. Connect
                  to author a plan — nine fields, one preview, then publish.
                </p>
                <Inline gap="3">
                  <SignInXButton />
                </Inline>
              </Panel>
              <ol className="pass-onboarding-preview" aria-label="The Pass form fields">
                {CREATE_FIELDS.map((f, i) => (
                  <li key={f} className="pass-onboarding-preview-step">
                    <span className="pass-onboarding-preview-num" aria-hidden="true">
                      {`0${i + 1}`}
                    </span>
                    <span className="pass-onboarding-preview-question">{f}</span>
                  </li>
                ))}
              </ol>
            </Stack>
          </Section>
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
          <Section label={editId ? "Edit Pass" : "Create a Pass"}>
            <span className="pass-settings-kicker">
              {editId ? "Revise the plan" : "Author a plan"}
            </span>
            <h1 className="pass-asset-line">{editId ? "Edit Pass" : "Create a Pass"}</h1>
            <p className="pass-thesis" style={{ marginBlockStart: "var(--space-3)" }}>
              {editId ? (
                <>
                  Version {editVersion ?? "…"}.
                  {editPublicId ? (
                    <>
                      {" "}Public URL <Link href={`/p/${editPublicId}`} className="pass-link-btn">{`/p/${editPublicId}`}</Link>.
                    </>
                  ) : null}{" "}
                  Saving an execution-relevant change mints a new version before
                  it goes visible.
                </>
              ) : (
                <>
                  A Trader publishes a plan, not a size instruction. Takers choose
                  their own size.
                </>
              )}
            </p>
          </Section>

          {savedVersion !== null ? (
            <div role="status" aria-live="polite">
              <ValidationMessage>
                Saved — now version {savedVersion}.
                {editPublicId ? (
                  <>
                    {" "}The public page shows the new version.
                  </>
                ) : null}
              </ValidationMessage>
            </div>
          ) : null}

          {failed ? <ErrorBlock detail={failed} onRetry={boot} /> : null}

          {/* §10.5 — the live preview, the same primitives as the Pass page. */}
          <ChamferPanel label="Pass preview" className="pass-create-preview">
            <CoordinateGrid
              className={isHip4 ? "pass-coordinate-grid--prediction" : undefined}
            >
              <CoordinatePair
                label="Market type"
                value={isHip4 ? "Prediction" : "Perps"}
              />
              {isHip4 ? (
                <>
                  <CoordinatePair
                    label="Side"
                    value={direction === "long" ? "Yes" : "No"}
                  />
                  <CoordinatePair
                    label="Outcome"
                    value={outcomeName || "—"}
                    className="pass-coordinate-pair--wide"
                  />
                  <CoordinatePair label="Limit" value={predictionLimit || "—"} />
                  <CoordinatePair label="Size" value={`${predictionSize || "—"} USDH`} />
                </>
              ) : (
                <>
                  <CoordinatePair label="Asset" value={asset || "—"} />
                  <CoordinatePair label="Direction" value={direction === "long" ? "Long" : "Short"} />
                  <CoordinatePair label="Entry" value={entry || "—"} />
                  <CoordinatePair label="TP" value={tp || "—"} />
                  <CoordinatePair label="SL" value={sl || "—"} />
                  <CoordinatePair label="Leverage" value={`${leverage}x`} />
                </>
              )}
            </CoordinateGrid>
          </ChamferPanel>

          <Stack gap="5" className="pass-create-form">
            <div className="pass-market-mode">
              <span className="pass-settings-kicker">Market type</span>
              <SegmentedControl
                options={[
                  { value: "perp", label: "Perps" },
                  { value: "prediction", label: "Prediction Markets" },
                ]}
                value={marketMode}
                onChange={switchMarketMode}
                label="Market type"
              />
              {marketMode === "prediction" ? (
                <p className="pass-note">
                  {predictionOutcomes.length === 0
                    ? "Prediction markets are not enabled on this venue."
                    : "Binary YES/NO markets. No leverage, take profit, stop loss or perp entry price."}
                </p>
              ) : null}
            </div>

            <div className="pass-form-grid pass-form-grid--two">
              {isHip4 ? (
                <Field label="Outcome Market" required className="pass-terminal-field">
                  {({ controlId }) => (
                    <Select
                      id={controlId}
                      value={String(predictionOutcomeId ?? "")}
                      onChange={(value) => choosePredictionOutcome(Number(value))}
                      className="pass-terminal-select"
                      options={predictionOutcomes.map((outcome) => ({
                        value: String(outcome.id),
                        label: outcome.name,
                      }))}
                    />
                  )}
                </Field>
              ) : (
                <Field label="Asset" required className="pass-terminal-field">
                  {({ controlId }) => (
                    <Select
                      id={controlId}
                      value={asset}
                      onChange={chooseAsset}
                      className="pass-terminal-select"
                      options={perpMarkets.map((m) => ({
                        value: m.asset,
                        label: m.label ?? `${m.asset}-${m.dex.toUpperCase()}`,
                      }))}
                    />
                  )}
                </Field>
              )}

              <Field
                label={isHip4 ? "Side" : "Direction"}
                required
                className="pass-terminal-field"
                helper={isHip4 ? "Yes is long the outcome; No is short it." : undefined}
              >
                {({ controlId: _c }) => (
                  <SegmentedControl
                    options={isHip4 ? OUTCOME_DIRECTIONS : DIRECTIONS}
                    value={direction}
                    onChange={chooseDirection}
                    label={isHip4 ? "Side" : "Direction"}
                  />
                )}
              </Field>
            </div>

            {isHip4 ? (
              <>
                <div className="pass-form-grid pass-form-grid--two">
                  <Field
                    label="Limit Price"
                    required
                    error={errors.predictionLimit}
                    helper="Probability between 0.01 and 0.99."
                    className="pass-terminal-field"
                  >
                    {({ controlId, describedBy }) => (
                      <NumericInput
                        id={controlId}
                        value={predictionLimit}
                        onChange={setPredictionLimit}
                        describedBy={describedBy}
                        invalid={Boolean(errors.predictionLimit)}
                        placeholder="0.50"
                        className="pass-terminal-number"
                      />
                    )}
                  </Field>
                  <Field
                    label="Reference Size"
                    required
                    error={errors.predictionSize}
                    helper="USDH. The Taker still chooses their own size."
                    className="pass-terminal-field"
                  >
                    {({ controlId, describedBy }) => (
                      <NumericInput
                        id={controlId}
                        value={predictionSize}
                        onChange={setPredictionSize}
                        describedBy={describedBy}
                        invalid={Boolean(errors.predictionSize)}
                        placeholder="100"
                        suffix="USDH"
                        className="pass-terminal-number"
                      />
                    )}
                  </Field>
                </div>
                <p className="pass-note" role="note">
                  Collateral for predictions is USDH. The Pass executes at the
                  live probability; the limit and size are recorded as reference
                  values.
                </p>
              </>
            ) : (
              <>
                <div className="pass-entry-mode">
                  <span className="pass-settings-kicker">Execution style</span>
                  <Field label="Entry type" required className="pass-terminal-field">
                    {({ controlId: _c }) => (
                      <SegmentedControl
                        options={ENTRY_TYPES}
                        value={entryType}
                        onChange={setEntryType}
                        label="Entry type"
                      />
                    )}
                  </Field>
                  <p className="pass-stale">
                    Limit rests at your authored price. Market signs an
                    immediate-or-cancel order at the live market.
                  </p>
                </div>

                <div className="pass-form-grid pass-form-grid--three">
                  {/* Market entries use the live market at execution time
                      (D-025.1) — the author never types a price, so no input
                      renders. Limit entries keep the input as-is. */}
                  {entryType === "limit" ? (
                    <Field
                      label="Entry price"
                      required
                      error={errors.entry}
                      className="pass-terminal-field"
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
                          className="pass-terminal-number"
                        />
                      )}
                    </Field>
                  ) : (
                    <p className="pass-stale pass-form-note" role="note">
                      Market entry uses the current market price at execution
                      time.
                    </p>
                  )}

                  <Field
                    label="Stop loss"
                    required
                    error={errors.sl}
                    className="pass-terminal-field"
                  >
                    {({ controlId, describedBy }) => (
                      <NumericInput
                        id={controlId}
                        value={sl}
                        onChange={setSl}
                        describedBy={describedBy}
                        invalid={Boolean(errors.sl)}
                        placeholder="0.00"
                        suffix="USDC"
                        className="pass-terminal-number"
                      />
                    )}
                  </Field>

                  <Field
                    label="Take profit"
                    required
                    error={errors.tp}
                    className="pass-terminal-field"
                  >
                    {({ controlId, describedBy }) => (
                      <NumericInput
                        id={controlId}
                        value={tp}
                        onChange={setTp}
                        describedBy={describedBy}
                        invalid={Boolean(errors.tp)}
                        placeholder="0.00"
                        suffix="USDC"
                        className="pass-terminal-number"
                      />
                    )}
                  </Field>
                </div>

                <div className="pass-form-grid pass-form-grid--two">
                  <Field
                    label="Leverage"
                    required
                    error={errors.leverage}
                    helper="Permitted range shown."
                    className="pass-terminal-field"
                  >
                    {({ controlId, describedBy }) => (
                      <LeverageStepper
                        id={controlId}
                        value={leverage}
                        onChange={setLeverage}
                        min={1}
                        max={MAX_LEVERAGE}
                        describedBy={describedBy}
                      />
                    )}
                  </Field>

                </div>
              </>
            )}

            <div className="pass-form-grid pass-form-grid--two">
              <Field
                label="Expiry"
                required
                error={errors.expiry}
                className="pass-terminal-field"
              >
                {({ controlId, describedBy }) => (
                  <TextInput
                    id={controlId}
                    value={expiry}
                    onChange={setExpiry}
                    describedBy={describedBy}
                    invalid={Boolean(errors.expiry)}
                    placeholder="2026-10-07T14:22"
                    className="pass-terminal-input"
                  />
                )}
              </Field>
              {/* Display only: the raw input value above is what the API
                  receives. This line reads it back human-readably. */}
              {expiry && !Number.isNaN(new Date(expiry).getTime()) ? (
                <p className="pass-stale pass-form-note" role="note">
                  Expires {formatDateTime(expiry)} (your local time).
                </p>
              ) : null}
            </div>

            <Field
              label="Thesis"
              required
              helper="Say why. The Taker reads this first."
              className="pass-terminal-field pass-thesis-field"
            >
              {({ controlId, describedBy }) => (
                <Textarea
                  id={controlId}
                  value={thesis}
                  onChange={setThesis}
                  describedBy={describedBy}
                  rows={5}
                  className="pass-terminal-input"
                />
              )}
            </Field>
          </Stack>

          {/* §10.5 — Publish is disabled WITH AN INLINE REASON until valid. */}
          <Inline gap="3">
            {editId ? (
              <Button
                variant="primary"
                size="lg"
                className="pass-execute-btn"
                onClick={saveEdit}
                disabledReason={
                  busy
                    ? "Saving…"
                    : editVersion === null
                      ? "Loading this Pass."
                      : valid
                        ? undefined
                        : "Complete the required fields and clear the messages above."
                }
              >
                Save changes
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="pass-execute-btn"
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
            )}
            <Link href={editId ? "/me/passes" : "/"} className="pass-link-btn">
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