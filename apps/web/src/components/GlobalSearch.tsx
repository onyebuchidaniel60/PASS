"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import type { SearchDto } from "@pass/contracts";

import { clientGet } from "@/lib/client";
import { Dialog } from "@/components/wave5/Dialog";
import { Avatar } from "@/components/wave3/identity";

/**
 * Global search / command palette.
 *
 * Cmd/Ctrl+K opens it from any page. The API returns Traders and Passes as
 * separate sets; this surface keeps them separate too, because a profile and a
 * plan are different destinations and merging them into one list would hide
 * which one a click is about to open.
 *
 * The dialog primitive owns the focus trap, Escape handling and focus restore.
 * This component owns the query debounce, the two result sections, and the
 * full-screen mobile treatment.
 */

type SearchState = "idle" | "loading" | "error";

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={["pass-search-icon", className].filter(Boolean).join(" ")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchDto | null>(null);
  const [state, setState] = useState<SearchState>("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  const close = () => setOpen(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setState("idle");
      return;
    }
    // The dialog moves focus to its first control, but focusing the input
    // explicitly makes the palette usable even if the close button is first.
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults(null);
      setState("idle");
      return;
    }

    setState("loading");
    let live = true;
    const timer = window.setTimeout(async () => {
      try {
        const data = await clientGet<SearchDto>(
          `/api/v1/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!live) return;
        setResults(data);
        setState("idle");
      } catch {
        if (!live) return;
        setResults(null);
        setState("error");
      }
    }, 180);

    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const hasQuery = query.trim().length > 0;
  const noResults =
    state === "idle" &&
    hasQuery &&
    results !== null &&
    results.traders.length === 0 &&
    results.passes.length === 0;

  return (
    <>
      <button
        type="button"
        className="pass-search-trigger"
        aria-label="Search PASS"
        aria-keyshortcuts="Meta+K Control+K"
        title="Search PASS (⌘K)"
        onClick={() => setOpen(true)}
      >
        <SearchGlyph />
        <span className="pass-search-trigger-hint" aria-hidden="true">
          ⌘K
        </span>
      </button>

      <Dialog
        open={open}
        onClose={close}
        title="Search PASS"
        scrimClassName="pass-search-scrim"
        panelClassName="pass-search-dialog"
      >
        <button
          type="button"
          className="pass-search-close"
          aria-label="Close search"
          onClick={close}
        >
          Close
        </button>

        <div className="pass-search-field">
          <SearchGlyph />
          <label className="visually-hidden" htmlFor={inputId}>
            Search traders and Passes
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className="pass-search-input"
            type="search"
            value={query}
            placeholder="Search traders, BTC, ETH, or a Pass ID"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd className="pass-search-kbd" aria-hidden="true">
            ESC
          </kbd>
        </div>

        <div
          className="pass-search-results"
          aria-live="polite"
          aria-busy={state === "loading"}
        >
          {state === "error" ? (
            <p className="pass-search-empty">
              Search is unavailable right now. Try again.
            </p>
          ) : state === "loading" ? (
            <p className="pass-search-empty">Searching…</p>
          ) : !hasQuery ? (
            <p className="pass-search-empty">
              Search by trader, asset, or Pass ID.
            </p>
          ) : noResults ? (
            <p className="pass-search-empty">No results found.</p>
          ) : results ? (
            <>
              {results.traders.length > 0 ? (
                <section
                  className="pass-search-section"
                  aria-labelledby={`${inputId}-traders`}
                >
                  <div className="pass-search-section-head">
                    <h3 id={`${inputId}-traders`}>Traders</h3>
                    <span>{results.traders.length}</span>
                  </div>
                  <ul className="pass-search-list">
                    {results.traders.map((trader) => (
                      <li key={trader.slug}>
                        <Link
                          href={`/u/${trader.slug}`}
                          className="pass-search-result"
                          onClick={close}
                        >
                          <Avatar
                            src={trader.avatarUrl}
                            handle={trader.handle ?? trader.displayName}
                            size="sm"
                          />
                          <span className="pass-search-result-copy">
                            <span className="pass-search-result-title">
                              {trader.displayName}
                            </span>
                            <span className="pass-search-result-meta">
                              @{trader.handle ?? trader.slug}
                            </span>
                          </span>
                          <span className="pass-search-result-action">
                            Profile <span aria-hidden="true">↗</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {results.passes.length > 0 ? (
                <section
                  className="pass-search-section"
                  aria-labelledby={`${inputId}-passes`}
                >
                  <div className="pass-search-section-head">
                    <h3 id={`${inputId}-passes`}>Passes</h3>
                    <span>{results.passes.length}</span>
                  </div>
                  <ul className="pass-search-list">
                    {results.passes.map((pass) => (
                      <li key={pass.publicId}>
                        <Link
                          href={`/p/${pass.publicId}`}
                          className="pass-search-result"
                          onClick={close}
                        >
                          <span className="pass-search-pass-mark">
                            {pass.asset}
                          </span>
                          <span className="pass-search-result-copy">
                            <span className="pass-search-result-title">
                              {pass.asset} {pass.direction.toUpperCase()}
                            </span>
                            <span className="pass-search-result-meta">
                              @{pass.trader.handle ?? pass.trader.slug} ·{" "}
                              {statusLabel(pass.status)}
                            </span>
                          </span>
                          <span className="pass-search-result-action">
                            Pass <span aria-hidden="true">↗</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
