"use client";

/**
 * Avatar and ConnectionChip — the two primitives §10.10 needs.
 *
 * WHY THESE ARE NOT INLINE
 *
 * `Avatar` falls back through handle → initials → a neutral reticle, because an
 * author may have no avatar at all and an empty box reads as a broken image
 * rather than as an absence.
 *
 * `ConnectionChip` states FOUR conditions, not two. `connected` / `displayOnly`
 * (present but read-only) / `disconnected` / `error` are genuinely different
 * situations and the screen has to tell them apart, because each one implies a
 * different action. A two-state chip would have to lie about two of them.
 */

export interface AvatarProps {
  /** Image URL. Absent is normal, not an error. */
  src?: string | null;
  /** X handle or display name, used for initials. */
  handle?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ src, handle, size = "md", className }: AvatarProps) {
  const dims = { sm: 24, md: 40, lg: 72 }[size];
  const initials = (handle ?? "")
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();

  const style = {
    width: dims,
    height: dims,
    borderRadius: size === "sm" ? 4 : 6,
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    border: "1px solid var(--color-line-hairline)",
    background: "var(--color-surface-raised)",
    color: "var(--color-text-secondary)",
    fontFamily: "var(--font-data)",
    fontSize: `${Math.max(9, Math.round(dims / 2.6))}px`,
    letterSpacing: "0.02em",
  };

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={className} style={style} />;
  }
  if (initials) {
    return (
      <span className={className} style={style} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    <span className={className} style={style} aria-hidden="true">
      <svg width={Math.round(dims * 0.5)} height={Math.round(dims * 0.5)} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="0.75" opacity="0.25" />
      </svg>
    </span>
  );
}

export type ConnectionTone = "connected" | "displayOnly" | "disconnected" | "error";

export interface ConnectionChipProps {
  provider: string;
  tone: ConnectionTone;
  /** Provider display name, e.g. "Hyperliquid". */
  label?: string;
  /** Secondary note: what is missing, or why it failed. */
  detail?: string;
  /** Omitted when there is nothing to do, e.g. a display-only connection. */
  action?: { label: string; onClick: () => void; busy?: boolean };
}

const TONE_TEXT: Record<ConnectionTone, string> = {
  connected: "Connected",
  displayOnly: "Read only",
  disconnected: "Not connected",
  error: "Needs attention",
};

/**
 * State is in the LABEL, never in colour alone (§9.4). A red dot alone would fail
 * both contrast-by-meaning and colour-blind users; here the word carries it and
 * `data-tone` only reinforces.
 */
export function ConnectionChip({
  provider,
  tone,
  label,
  detail,
  action,
}: ConnectionChipProps) {
  return (
    <div
      className="pass-connection"
      data-tone={tone}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        border: "1px solid var(--color-line-hairline)",
        borderRadius: 6,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 2, flex: "1 1 180px" }}>
        <span style={{ fontWeight: 600 }}>{label ?? provider}</span>
        <span className="pass-connection-state" data-tone={tone}>
          {TONE_TEXT[tone]}
        </span>
        {detail ? (
          <span className="pass-stale" style={{ fontSize: "var(--type-body-s-size)" }}>
            {detail}
          </span>
        ) : null}
      </div>

      {action ? (
        <button
          type="button"
          className="pass-btn"
          data-variant={tone === "connected" ? "secondary" : "primary"}
          data-size="sm"
          disabled={action.busy}
          onClick={action.onClick}
        >
          {action.busy ? "Working" : action.label}
        </button>
      ) : null}
    </div>
  );
}