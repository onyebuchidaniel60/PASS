import { MAX_LEVERAGE } from "@pass/contracts";
import type {
  MarketClass,
  PassDirection,
  PassEntryType,
  TradePlanSnapshot,
} from "@pass/contracts";
import { inferMarketClass, isOutcomeCoin } from "./markets.js";

/**
 * docs/UX_SPEC.md §7 requires live validation for price ordering, supported
 * market, leverage bounds, expiry validity, and TP/SL direction consistency.
 *
 * Every failure carries a canonical error code from docs/API_CONTRACTS.md §14.
 */

export interface PlanLike {
  asset: string;
  /** Absent on legacy callers: inferred from the coin string. */
  marketClass?: MarketClass | null;
  /** HIP-4 display name; ignored for perp/spot. */
  outcomeName?: string | null;
  direction: PassDirection;
  entryType: PassEntryType;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  leverage: string | null;
  expiresAt: string | null;
}

export interface ValidationFailure {
  field: string;
  code: string;
  message: string;
}

/** Re-exported so server code keeps one import; the value lives in @pass/contracts. */
export { MAX_LEVERAGE };

function num(v: string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function validatePlan(
  plan: PlanLike,
  opts: { supportedAssets?: readonly string[]; now?: Date } = {},
): ValidationFailure[] {
  const out: ValidationFailure[] = [];
  const supported = opts.supportedAssets;

  const entry = num(plan.entryPrice);
  const sl = num(plan.stopLoss);
  const tp = num(plan.takeProfit);
  const lev = num(plan.leverage);
  const marketClass = plan.marketClass ?? inferMarketClass(plan.asset);
  const isHip4 = marketClass === "hip4";

  if (supported && !supported.includes(plan.asset)) {
    out.push({
      field: "asset",
      code: "INVALID_ASSET",
      message: "That market is not supported.",
    });
  }

  // A class and a coin that disagree are refused: a "#N" Pass is never a
  // perp, and a perp Pass is never routed through the outcome builder.
  if (isHip4 && !isOutcomeCoin(plan.asset)) {
    out.push({
      field: "asset",
      code: "INVALID_ASSET",
      message: "An outcome Pass needs a valid outcome market (#N).",
    });
  }
  if (!isHip4 && isOutcomeCoin(plan.asset)) {
    out.push({
      field: "asset",
      code: "INVALID_ASSET",
      message: "That asset is an outcome market; set marketClass to hip4.",
    });
  }

  if (plan.direction !== "long" && plan.direction !== "short") {
    out.push({
      field: "direction",
      code: "INVALID_DIRECTION",
      message: "Direction must be long or short.",
    });
  }

  if (isHip4) {
    /**
     * HIP-4 outcomes are market-entry only: the Taker executes at the
     * probability the book offers, and there is no venue TP/SL, leverage or
     * liquidation. The Pass must not carry values it cannot execute.
     */
    if (plan.entryType !== "market") {
      out.push({
        field: "entryType",
        code: "INVALID_REQUEST",
        message: "An outcome Pass must use a market entry.",
      });
    }
    if (entry !== null) {
      out.push({
        field: "entryPrice",
        code: "INVALID_PRICE",
        message: "An outcome Pass must not carry an entry price.",
      });
    }
    if (sl !== null) {
      out.push({
        field: "stopLoss",
        code: "INVALID_PRICE",
        message: "Outcome markets have no stop loss. Leave it empty.",
      });
    }
    if (tp !== null) {
      out.push({
        field: "takeProfit",
        code: "INVALID_PRICE",
        message: "Outcome markets have no take profit. Leave it empty.",
      });
    }
    if (lev !== null) {
      out.push({
        field: "leverage",
        code: "INVALID_LEVERAGE",
        message: "Outcome markets have no leverage. Leave it empty.",
      });
    }
  } else {
    // Entry price is required for limit entries and forbidden for market entries.
    if (plan.entryType === "limit") {
      if (entry === null) {
        out.push({
          field: "entryPrice",
          code: "INVALID_PRICE",
          message: "A limit Pass needs an entry price.",
        });
      } else if (entry <= 0) {
        out.push({
          field: "entryPrice",
          code: "INVALID_PRICE",
          message: "Entry price must be greater than zero.",
        });
      }
    } else if (entry !== null) {
      out.push({
        field: "entryPrice",
        code: "INVALID_PRICE",
        message: "A market Pass must not carry an entry price.",
      });
    }

    if (sl !== null && sl <= 0) {
      out.push({
        field: "stopLoss",
        code: "INVALID_PRICE",
        message: "Stop loss must be greater than zero.",
      });
    }
    if (tp !== null && tp <= 0) {
      out.push({
        field: "takeProfit",
        code: "INVALID_PRICE",
        message: "Take profit must be greater than zero.",
      });
    }

    // Price ordering / direction consistency, anchored on entry when present.
    const anchor = entry ?? null;
    if (anchor !== null) {
      if (plan.direction === "long") {
        if (sl !== null && sl >= anchor) {
          out.push({
            field: "stopLoss",
            code: "INVALID_PRICE",
            message: "For a long Pass the stop loss must sit below entry.",
          });
        }
        if (tp !== null && tp <= anchor) {
          out.push({
            field: "takeProfit",
            code: "INVALID_PRICE",
            message: "For a long Pass the take profit must sit above entry.",
          });
        }
      } else {
        if (sl !== null && sl <= anchor) {
          out.push({
            field: "stopLoss",
            code: "INVALID_PRICE",
            message: "For a short Pass the stop loss must sit above entry.",
          });
        }
        if (tp !== null && tp >= anchor) {
          out.push({
            field: "takeProfit",
            code: "INVALID_PRICE",
            message: "For a short Pass the take profit must sit below entry.",
          });
        }
      }
    }

    if (lev !== null && (lev < 1 || lev > MAX_LEVERAGE)) {
      out.push({
        field: "leverage",
        code: "INVALID_LEVERAGE",
        message: `Leverage must be between 1 and ${MAX_LEVERAGE}.`,
      });
    }
  }

  if (plan.expiresAt !== null) {
    const now = opts.now ?? new Date();
    const exp = new Date(plan.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      out.push({
        field: "expiresAt",
        code: "INVALID_PRICE",
        message: "Expiry is not a valid timestamp.",
      });
    } else if (exp.getTime() <= now.getTime()) {
      out.push({
        field: "expiresAt",
        code: "INVALID_PRICE",
        message: "Expiry must be in the future.",
      });
    }
  }

  return out;
}

/** Placeholder key removed; asset is carried on PlanLike. */

export function snapshotFromPlan(plan: PlanLike, asset: string, dex: string | null): TradePlanSnapshot {
  return {
    asset,
    dex,
    marketClass: plan.marketClass ?? inferMarketClass(asset),
    outcomeName: plan.outcomeName ?? null,
    direction: plan.direction,
    entryType: plan.entryType,
    entryPrice: plan.entryPrice ?? null,
    stopLoss: plan.stopLoss ?? null,
    takeProfit: plan.takeProfit ?? null,
    leverage: plan.leverage ?? null,
    expiresAt: plan.expiresAt ?? null,
  };
}