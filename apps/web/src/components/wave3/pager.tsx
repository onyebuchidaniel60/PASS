"use client";

/**
 * Pager — the pagination control for the two authenticated inventory
 * surfaces (My Passes §10.8, Executions §10.9).
 *
 * Justification for a new component: the composition does not exist. The
 * reference set (images 15, 16) requires a "Showing X–Y of Z" summary plus
 * prev / numbered / next controls on both tables, and no primitive composes
 * those. Page-number buttons reuse `ChipButton` (toggle + selected) rather
 * than inventing a second selected-button style.
 *
 * One definition: both tables slice through `paginate` here, so the window
 * math cannot drift between the two surfaces.
 */

import { ChipBar, ChipButton } from "@/components/reference";

/** Rows per table page. One value for both inventory tables. */
export const PAGE_SIZE = 8;

export interface PageWindow<T> {
  /** The rows for the current page. Empty when there is nothing to show. */
  pageRows: T[];
  /** 1-based. Clamped into range, so a deletion cannot strand the view. */
  page: number;
  /** 0 when there are no rows. */
  pageCount: number;
  /** e.g. "Showing 1–8 of 12 passes". */
  summary: string;
}

/**
 * Slices `rows` to the 1-based `page`. Pure, so both tables share the exact
 * same window math (FRONTEND skill §9 rule 1: one definition).
 */
export function paginate<T>(rows: readonly T[], page: number, noun: string): PageWindow<T> {
  const total = rows.length;
  const pageCount = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const safe = pageCount === 0 ? 1 : Math.min(Math.max(1, page), pageCount);
  const start = (safe - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);
  const summary =
    total === 0
      ? `Showing 0 of 0 ${noun}`
      : `Showing ${start + 1}–${start + pageRows.length} of ${total} ${noun}`;
  return { pageRows, page: safe, pageCount, summary };
}

export interface PagerProps {
  page: number;
  pageCount: number;
  summary: string;
  onPage: (page: number) => void;
}

/**
 * Summary left, controls right; wraps on narrow viewports. Renders nothing
 * when there is a single page — a pager for one page is decoration, and
 * decorative motion/chrome is removed, not kept.
 */
export function Pager({ page, pageCount, summary, onPage }: PagerProps) {
  if (pageCount <= 1) return null;
  const numbers = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <nav className="pass-pager" aria-label="Pagination">
      <span className="pass-stale">{summary}</span>
      <ChipBar label="Pages">
        <ChipButton onClick={() => onPage(page - 1)} disabled={page <= 1} label="Previous page">
          {"‹"}
        </ChipButton>
        {numbers.map((n) => (
          <ChipButton key={n} toggle selected={n === page} onClick={() => onPage(n)} label={`Page ${n}`}>
            {String(n)}
          </ChipButton>
        ))}
        <ChipButton
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          label="Next page"
        >
          {"›"}
        </ChipButton>
      </ChipBar>
    </nav>
  );
}
