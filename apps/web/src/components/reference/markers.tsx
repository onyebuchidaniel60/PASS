"use client";

/**
 * §14.2 corner brackets, §14.6 status badges, §14.7 live indicators, §14.9
 * chip buttons.
 *
 * Grouped because each is a small self-contained marker with one job, and each
 * earns its place by making something the reference has and the Stage K build
 * did not: a frame, an icon on a state, a pulse, a chamfered filter control.
 *
 * `CornerBracketFrame` costs two pseudo-elements for the top pair and one empty
 * child for the bottom pair, because a single element cannot have two
 * `::after` boxes in different corners. The child is rendered by this component,
 * so a caller cannot forget it.
 */

import type { ReactNode } from "react";

export interface CornerBracketFrameProps {
  children: ReactNode;
  className?: string;
  /** Forwarded to the wrapper, e.g. `aria-labelledby`. */
  labelledBy?: string;
  as?: "div" | "section" | "article" | "header";
}

/**
 * §14.2. Rationed to four uses in the whole product: the Landing hero frame,
 * the Pass detail top card, the trader profile header, and the Landing step
 * grid as a group. It is a framing device; it never sits on a dense table.
 */
export function CornerBracketFrame({
  children,
  className,
  labelledBy,
  as: As = "div",
}: CornerBracketFrameProps) {
  return (
    <As
      className={["pass-brackets", className].filter(Boolean).join(" ")}
      aria-labelledby={labelledBy}
    >
      {children}
      {/* Purely presentational: the bottom brackets. */}
      <span className="pass-brackets-foot" aria-hidden="true" />
    </As>
  );
}

export type StatusTone =
  | "draft"
  | "active"
  | "entry_pending"
  | "open"
  | "tp_hit"
  | "sl_hit"
  | "cancelled"
  | "expired"
  | "invalidated";

/** §14.6. The WORD is the state; the icon and the colour reinforce it (§9.4). */
const TONE_ICON: Record<StatusTone, ReactNode> = {
  draft: <path d="M4 14.5V16h1.5l8-8L12 6.5zM13 5.5l1.5-1.5 1.5 1.5L14.5 7z" />,
  active: <circle cx="10" cy="10" r="4" />,
  entry_pending: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.5" />
    </>
  ),
  open: (
    <>
      <circle cx="10" cy="10" r="4" />
      <circle cx="10" cy="10" r="7" opacity="0.5" />
    </>
  ),
  tp_hit: <path d="M5 15L15 5M15 5h-6M15 5v6" />,
  sl_hit: <path d="M5 5l10 10M15 15H9M15 15V9" />,
  cancelled: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M5.5 14.5l9-9" />
    </>
  ),
  expired: (
    <>
      <path d="M5 8h10M7 8v7h6V8" />
      <path d="M8 5h4" />
    </>
  ),
  invalidated: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v5M10 13.5v.5" />
    </>
  ),
};

export interface StatusBadgeProps {
  tone: StatusTone;
  /** The state, written out. This is the meaning; the icon is not. */
  label: string;
  /** `bare` on a card's status row, where a pill would spend the accent twice. */
  variant?: "pill" | "bare";
  className?: string;
}

export function StatusBadge({ tone, label, variant = "pill", className }: StatusBadgeProps) {
  return (
    <span
      className={["pass-badge", className].filter(Boolean).join(" ")}
      data-tone={tone}
      data-variant={variant}
    >
      <svg
        className="pass-badge-icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {TONE_ICON[tone]}
      </svg>
      {label}
    </span>
  );
}

export interface LiveDotProps {
  /** The word that carries the information. Never omit it: the dot is not it. */
  label?: string;
  className?: string;
}

/** §14.7. Pulses twice, then rests. §14.13 permits no looping animation. */
export function LiveDot({ label = "Live", className }: LiveDotProps) {
  return (
    <span className={["pass-live", className].filter(Boolean).join(" ")}>
      <span className="pass-live-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export interface ChipButtonProps {
  children: ReactNode;
  onClick?: () => void;
  /** Renders a `button`; omit and pass `href` to render an `a`. */
  href?: string;
  /** True when this chip is the one active filter. §2.5 permits one per region. */
  selected?: boolean;
  disabled?: boolean;
  /** Marks the control as a filter choice for assistive technology. */
  toggle?: boolean;
  className?: string;
  type?: "button" | "submit";
}

/** §14.9. Chamfered, not rounded — consistent with §5.1 and §5.2. */
export function ChipButton({
  children,
  onClick,
  href,
  selected = false,
  disabled = false,
  toggle = false,
  className,
  type = "button",
}: ChipButtonProps) {
  const cls = ["pass-chip", className].filter(Boolean).join(" ");
  const pressed = toggle ? selected : undefined;

  if (href) {
    return (
      <a
        className={cls}
        href={href}
        aria-pressed={pressed}
        data-selected={selected ? "true" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      data-selected={selected ? "true" : undefined}
    >
      {children}
    </button>
  );
}

export function ChipBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={["pass-chip-bar", className].filter(Boolean).join(" ")}
      role={undefined}
    >
      {children}
    </div>
  );
}
