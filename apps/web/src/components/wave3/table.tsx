"use client";

/**
 * DataTable — the table primitive for the two authenticated inventory surfaces
 * (My Passes §10.8, Executions §10.9).
 *
 * Two rules from DESIGN.md drive the implementation and are easy to lose:
 *
 *  - NO HORIZONTAL SCROLLER. A table that scrolls sideways hides its last
 *    column, which on this product is expiry and PnL — the two numbers a Taker
 *    checks. Columns collapse into a stacked definition list below 720px
 *    instead.
 *  - NO ROW STRIPING. Zebra striping is a table-template default that fights
 *    the paper field; row separation comes from the rule line alone.
 *
 * `ghost` marks a draft or cancelled row. It reduces the ROW's presence, never
 * the opacity of its text: dimmed type fails contrast, and the row still has to
 * be readable to be cancelled.
 */

import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  /** Stable key. Also the label used by the stacked mobile layout. */
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Hidden in the stacked layout when false (e.g. secondary columns). */
  inStack?: boolean;
  /** Right-align numeric content. */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Rendered per row: a link wrapper for Pass rows, a button for expansions. */
  renderRow?: (row: T, key: string) => ReactNode;
  /** Low-emphasis treatment: draft and cancelled rows. */
  isGhost?: (row: T) => boolean;
  /**
   * Optional detail row, revealed per row (§10.9.2 reconstructability: the
   * provider order id and the referenced Pass version).
   *
   * Rendered as a second `<tr>` spanning the table rather than inside a cell, so
   * the detail is not trapped inside one column's width.
   */
  isExpanded?: (row: T) => boolean;
  renderDetail?: (row: T) => ReactNode;
  caption: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  renderRow,
  isGhost,
  isExpanded,
  renderDetail,
  caption,
}: DataTableProps<T>) {
  const stack = columns.filter((c) => c.inStack !== false);

  return (
    <>
      {/* Wide: a real table. Numeric columns align on the decimal. */}
      <table
        style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}
        data-testid="data-table"
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="stat"
                style={{
                  textAlign: c.numeric ? "right" : "left",
                  padding: "0 12px 8px",
                  borderBottom: "1px solid var(--rule)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const ghost = isGhost?.(row) ?? false;
            const cells = columns.map((c) => (
              <td
                key={c.key}
                className={c.numeric ? "num" : undefined}
                style={{
                  padding: "14px 12px",
                  borderBottom: "1px solid var(--rule)",
                  textAlign: c.numeric ? "right" : "left",
                  verticalAlign: "top",
                  // Ghost dims the row's surface, never its text colour.
                  background: ghost ? "var(--surface-sunken)" : undefined,
                }}
              >
                {c.render(row)}
              </td>
            ));
            const detail =
              isExpanded?.(row) && renderDetail ? (
                <tr key={`${key}-detail`} data-detail="true">
                  <td
                    colSpan={columns.length}
                    style={{ padding: "0 12px 16px", borderBottom: "1px solid var(--rule)" }}
                  >
                    {renderDetail(row)}
                  </td>
                </tr>
              ) : null;

            return (
              <>
                {renderRow ? (
                  <tr key={key} data-ghost={ghost || undefined}>
                    {renderRow(row, key)}
                  </tr>
                ) : (
                  <tr key={key} data-ghost={ghost || undefined}>
                    {cells}
                  </tr>
                )}
                {detail}
              </>
            );
          })}
        </tbody>
      </table>

      {/* Narrow: no sideways scrolling, so the columns become a stacked list. */}
      <ul className="stack-list" data-testid="data-table-stacked">
        {rows.map((row) => {
          const key = rowKey(row);
          const ghost = isGhost?.(row) ?? false;
          return (
            <li
              key={key}
              data-ghost={ghost || undefined}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid var(--rule)",
                background: ghost ? "var(--surface-sunken)" : undefined,
              }}
            >
              {isExpanded?.(row) && renderDetail ? (
                renderDetail(row)
              ) : renderRow ? (
                renderRow(row, key)
              ) : (
                <dl style={{ display: "grid", gap: "6px", margin: 0 }}>
                  {stack.map((c) => (
                    <div key={c.key} style={{ display: "flex", justifyContent: "space-between" }}>
                      <dt className="stat" style={{ color: "var(--ink-faint)" }}>
                        {c.label}
                      </dt>
                      <dd style={{ margin: 0, textAlign: "right" }}>{c.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** StatRow — a horizontal strip of figures with mono labels and no colour coding. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="stat-row"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${countChildren(children)}, minmax(0, 1fr))`,
        gap: "1px",
        background: "var(--rule)",
        border: "1px solid var(--rule)",
      }}
    >
      {children}
    </div>
  );
}

function countChildren(children: ReactNode): number {
  let n = 0;
  const walk = (c: ReactNode) => {
    if (Array.isArray(c)) c.forEach(walk);
    else if (c !== null && c !== undefined && c !== false) n += 1;
  };
  walk(children);
  return Math.max(n, 1);
}