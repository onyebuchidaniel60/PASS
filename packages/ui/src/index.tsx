"use client";

/**
 * Provisional PASS UI primitives.
 *
 * Stage K scope (docs/DECISIONS.md D-017): the one-shot build ships a usable
 * but provisional UI. These primitives are deliberately plain — neutral
 * greys, system font stack, no animation library, no component framework.
 * The design token layer and visual language are owned by Stage K
 * (design/DESIGN.md) and are NOT defined here.
 *
 * Do not install a UI framework or animation library to replace these
 * (AGENTS.md, design/DESIGN.md §12.1).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-neutral-900 text-white border border-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 disabled:border-neutral-400",
  secondary:
    "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-400",
  ghost:
    "bg-transparent text-neutral-700 border border-transparent hover:bg-neutral-100 disabled:text-neutral-400",
  danger:
    "bg-white text-red-700 border border-red-300 hover:bg-red-50 disabled:text-red-300",
};

const SIZE: Record<ButtonSize, string> = {
  // Minimum 44px touch target on interactive sizes (docs/UX_SPEC.md §12).
  sm: "px-3 py-2 text-sm min-h-[44px]",
  md: "px-4 py-2.5 text-sm min-h-[44px]",
  lg: "px-6 py-3 text-base min-h-[48px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  full = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
        "disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Status is always conveyed by text first; colour is secondary. */
export function StatusChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-neutral-700">
      {label}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded border border-neutral-200 bg-white", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Eyebrow label. Stage K owns the final visual treatment. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
      {children}
    </p>
  );
}

export function Rule() {
  return <hr className="border-0 border-t border-neutral-200" />;
}

export function StatBlock({
  label,
  value,
  hint,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p
        className={cn(
          "mt-1 text-2xl text-neutral-900",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  helper,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-800">
        {label}
      </label>
      {children}
      {helper && !error && (
        <p id={`${htmlFor}-helper`} className="text-xs text-neutral-500">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 " +
  "placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none " +
  "focus:ring-2 focus:ring-neutral-900/20 disabled:bg-neutral-100";

export const monoInputClass = `${inputClass} font-mono tabular-nums`;

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500"
    >
      {label}…
    </div>
  );
}

export function EmptyBlock({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded border border-dashed border-neutral-300 bg-white p-6 text-center">
      <p className="text-sm font-medium text-neutral-900">{title}</p>
      {body && <p className="mt-1 text-sm text-neutral-600">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorBlock({
  title = "Something failed",
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-900">{title}</p>
      {body && <p className="mt-1 text-sm text-red-800">{body}</p>}
      {onRetry && (
        <div className="mt-3">
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

/** Shown whenever provider responses are simulated fixtures. */
export function DemoBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      Demo data — provider integrations are running in mock mode. Figures are
      simulated and are not real market or trading data.
    </div>
  );
}