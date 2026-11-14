"use client";

/**
 * Mobile primary navigation.
 *
 * Below 1024px the four horizontal destinations are replaced by one 44px
 * hamburger. The menu is a full-screen Dialog, so it inherits the focus trap,
 * Escape handling, focus restore and modal semantics the overlay primitive
 * already owns. The trigger stays in the topbar actions track, hard right.
 *
 * The menu is editorial rather than a second copy of the topbar: numbered
 * rows, display type, hairline dividers, and the informational pages at the
 * foot. It closes on route change as well as on link press, so a browser Back
 * never leaves a stale overlay covering the page.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Dialog } from "@/components/wave5/Dialog";
import { INFO, isNavActive, NAV } from "@/lib/nav";

function MenuGlyph() {
  return (
    <svg
      className="pass-menu-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  // A route change is a completed intent; the overlay should not survive it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The Dialog primitive traps focus but does not own page scroll. Lock it
  // while the full-screen sheet is mounted, and restore the exact prior value.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="pass-menu-trigger"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MenuGlyph />
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Menu"
        panelClassName="pass-menu-dialog"
        scrimClassName="pass-menu-scrim"
      >
        <button
          type="button"
          className="pass-menu-close"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          Close <span aria-hidden="true">×</span>
        </button>

        <nav aria-label="Mobile primary">
          <ul className="pass-menu-list">
            {NAV.map((item, index) => {
              const active = isNavActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="pass-menu-link"
                    data-active={active ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <span className="pass-menu-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="pass-menu-label">{item.label}</span>
                    <span className="pass-menu-arrow" aria-hidden="true">
                      {"\u2197"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="pass-menu-foot">
          <p>
            Social execution for Hyperliquid.
            <br />
            Powered by NEAR Intents.
          </p>
          <ul className="pass-menu-foot-links">
            <li>
              <Link href="/docs" onClick={() => setOpen(false)}>
                Docs
              </Link>
            </li>
            <li>
              <Link href="/developers" onClick={() => setOpen(false)}>
                Developers
              </Link>
            </li>
            {INFO.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    </>
  );
}
