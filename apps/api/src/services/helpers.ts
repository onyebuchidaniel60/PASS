import {
  aggregatePassPerformance,
  round2,
  sideFor,
  toDecimalString,
} from "@pass/domain";

export { aggregatePassPerformance, round2, sideFor };

/**
 * Accepts a decimal string or a number and always returns a decimal string,
 * so no binary float ever reaches persistence (docs/DATA_MODEL.md §4).
 */
export function toDecimalStringSafe(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "0";
  if (typeof v === "string") return v;
  return toDecimalString(v);
}