"use client";

/**
 * Table cells for the inventory surfaces (§10.8, §10.9).
 *
 * These exist because the obvious inline `<span>` version loses two rules that
 * DESIGN.md §11 is explicit about:
 *
 *  - NUMBERS ARE MONO AND UNBROKEN. A price must not wrap mid-figure; a wrapped
 *    "113," / "400" reads as two numbers. `white-space: nowrap` plus the mono
 *    face keeps a figure scannable down a column.
 *  - A SIGN IS NEVER CARRIED BY COLOUR ALONE. §9.4: colour is secondary, the
 *    text is the meaning. Every PnL cell therefore renders the sign in the text
 *    itself, and `data-tone` only ever reinforces it.
 *
 * A missing value renders as an em dash, never as blank — an empty cell reads
 * as "zero" in a numeric column, which is a different and wrong number.
 */

export interface CellProps {
  children?: React.ReactNode;
  className?: string;
}

/** A figure: mono, right-aligned, never wrapped mid-number. */
export function PriceCell({
  value,
  tone,
  align = "right",
}: {
  value: string | number | null | undefined;
  tone?: "positive" | "negative" | "neutral";
  align?: "left" | "right";
}) {
  return (
    <span className="pass-num pass-cell-num" data-align={align} data-tone={tone}>
      {value ?? "—"}
    </span>
  );
}

/**
 * Realized PnL. Sign and colour travel together, never separately, so removing
 * colour loses nothing.
 */
export function PnlCell({ value, currency = "USDC" }: { value: string | number | null; currency?: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="pass-cell" data-tone="neutral">—</span>;
  }
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return <span className="pass-cell" data-tone="neutral">—</span>;

  const tone = n > 0 ? "positive" : n < 0 ? "negative" : "neutral";
  // U+2212 MINUS SIGN, not a hyphen: it aligns with digits in mono. The sign is
  // always explicit, including the positive case, so direction is never implied
  // by colour alone.
  const sign = n > 0 ? "+" : n < 0 ? "\u2212" : "";
  const body = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span className="pass-num pass-cell-num" data-align="right" data-tone={tone}>
      {`${sign}${body} ${currency}`}
    </span>
  );
}

/** A short uppercase mono label: a state name, a provider status. */
export function DataCell({
  children,
  tone,
}: {
  children?: React.ReactNode;
  tone?: "positive" | "negative" | "neutral" | "muted";
}) {
  return (
    <span className="pass-cell" data-tone={tone ?? "neutral"}>
      {children ?? "—"}
    </span>
  );
}

/**
 * A small mono tag for reference values — a provider order id, a pass version.
 * Not a status: `StatusChip` is for state, and reusing it here would imply these
 * values carry meaning they do not.
 */
export function Tag({ children, title }: { children?: React.ReactNode; title?: string }) {
  return (
    <span className="pass-tag" title={title}>
      {children ?? "—"}
    </span>
  );
}