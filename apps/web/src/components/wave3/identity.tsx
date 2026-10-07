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
  const initials = (handle ?? "")
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();

  const cls = ["pass-avatar", className].filter(Boolean).join(" ");

  if (src) {
    // A plain <img>: the avatar source is an arbitrary remote URL from the
    // provider profile, so next/image would need every host allow-listed.
    return <img src={src} alt="" className={cls} data-size={size} />;
  }
  if (initials) {
    return (
      <span className={cls} data-size={size} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    <span className={cls} data-size={size} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <div className="pass-connection" data-tone={tone}>
      <div className="pass-connection-body">
        <span className="pass-connection-label">{label ?? provider}</span>
        <span className="pass-connection-state" data-tone={tone}>
          {TONE_TEXT[tone]}
        </span>
        {detail ? <span className="pass-note">{detail}</span> : null}
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