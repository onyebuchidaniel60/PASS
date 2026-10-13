"use client";

/**
 * XIdentityControl — the topbar's identity slot. DESIGN.md §8.4 (three-region
 * shell), §14.9 (chips).
 *
 * POSITION: X first, wallet second. PASS is identity-first: the X handle is who
 * a Trader IS, while the wallet is only what they can sign with. A trader with
 * no wallet but an X handle is still a trader, so the handle sits left of it.
 *
 * WHY IT IS NOT A THIRD-PARTY WIDGET
 *
 * `WalletControl` already settled this: ConnectKit renders its own button and
 * its own Tailwind classes, which put a foreign control in the middle of a
 * product with its own type scale and tokens. The same rule applies here. X
 * OAuth needs no SDK to begin — it is a 302 to our own backend, which then
 * redirects to X — so the only third-party thing in this flow is X's own
 * consent screen, which is the right place for it.
 *
 * THE STATES, all testable:
 *
 *   signed out — "Sign in with X". Same 302 as the backend route, so the flow
 *                begins server-side and PKCE/state are minted where the secret
 *                configuration lives. This renders on FIRST PAINT (including
 *                before /me resolves): the unknown state and the signed-out
 *                state render the same button, so there is no empty slot, no
 *                flash, and no layout shift. A signed-in viewer briefly sees
 *                the sign-in button until /me resolves; the reverse (an empty
 *                slot that pops a button in for every signed-out visitor)
 *                was the worse flash, because signed-out is the common case.
 *   connected  — the X handle (@username from /me, never the wallet address
 *                or the PASS display name). Clicking it opens a dropdown with
 *                "Disconnect X", which terminates the PASS session (D-024).
 *   error      — treated as signed out. A control that shows "disconnected" when
 *                the truth is "we could not tell" is a small lie that produces
 *                a confusing sign-in loop.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/wave2/controls";
import { clientGet, clientPost } from "@/lib/client";
import { onMeChanged } from "@/lib/me-events";
import { xConnection, type MePayload } from "@/lib/me";

/**
 * The slice of `GET /api/v1/me` this control needs, derived from the FLAT
 * `connections[]` payload (see `@/lib/me`). There is no nested `x` object
 * on the wire: reading `me.x.connected` crashed every signed-in page
 * (TypeError on `undefined`), because `clientGet<T>` is an unchecked cast
 * and nothing validated the assumption. This view-model is built by
 * `toViewModel`, which is total — unknown shapes map to signed out.
 */
interface MeIdentity {
  connected: boolean;
  handle: string | null;
  displayOnly: boolean;
}

const SIGNED_OUT: MeIdentity = { connected: false, handle: null, displayOnly: false };

function toViewModel(data: unknown): MeIdentity {
  const entry = xConnection(data as MePayload | null | undefined);
  if (entry?.connected && entry.handle) {
    return { connected: true, handle: entry.handle, displayOnly: entry.displayOnly ?? false };
  }
  return SIGNED_OUT;
}

/** The signed-out button. Rendered on first paint AND after sign-out. */
function SignInButton() {
  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => {
        // Full navigation, not a client-side fetch. The backend 302s to X,
        // and PKCE + state are minted server-side, so there is nothing to do
        // in JS — and a router.push would not follow the 302.
        // Stage B: same-origin so the whole OAuth round trip stays on the
        // Vercel domain via the Next rewrite proxy (see next.config.mjs).
        // The previous cross-origin call left the session cookie
        // Railway-scoped and invisible to /me.
        if (typeof window !== "undefined") {
          window.location.assign("/api/v1/auth/x/start");
        }
      }}
    >
      {/* The long label is the one thing in the actions track that does not
          fit beside the wallet control on a phone. `.pass-x-label` swaps to
          "Sign in" under the mobile breakpoint rather than wrapping, because a two-line
          button is worse than a shorter one and `nowrap` would overflow
          instead.

          ONE span, not an aria-hidden/visually-hidden pair: two spans
          holding the same words doubled the button's text content. This span
          keeps the full wording, so the accessible name and the text
          content are both exactly "Sign in with X", and only the rendered
          glyphs shorten. */}
      <span className="pass-x-label">Sign in with X</span>
    </Button>
  );
}

export function XIdentityControl() {
  // `null` = not yet probed. It renders the SAME button as signed-out, so
  // first paint (server HTML included) already holds the control at its
  // final size and position — no empty slot, no late mount.
  const [me, setMe] = useState<MeIdentity | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await clientGet<MePayload>("/api/v1/me");
      setMe(toViewModel(data));
    } catch {
      // A signed-out visitor gets 401. That is the common case, not an error,
      // so it maps to "signed out" rather than to an error banner in the topbar.
      setMe(SIGNED_OUT);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-read /me when another surface mutates connection state (same Bug 2a
  // discipline as Settings: one event bus, every identity surface stays true).
  useEffect(() => onMeChanged(load), [load]);

  // The dropdown closes on Escape and on outside press. Both listeners live
  // only while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open ]);

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await clientPost("/api/v1/auth/x/disconnect");
      // D-024: the session is over, so its key material ends with it.
      const { clearSessionKeys } = await import("@/lib/agent-keystore");
      clearSessionKeys();
    } catch {
      setFailed(true);
      setBusy(false);
      return;
    }
    const { notifyMeChanged } = await import("@/lib/me-events");
    notifyMeChanged();
    setBusy(false);
    setOpen(false);
    // Signed out: the slot returns to the sign-in button. No
    // session-without-identity intermediate exists (D-024).
    setMe(SIGNED_OUT);
  };

  if (!me?.connected || !me.handle) {
    return (
      <span className="pass-x" data-state="signed-out">
        <SignInButton />
      </span>
    );
  }

  return (
    <span className="pass-x" data-state="connected">
      <span className="pass-x-menu" ref={menuRef}>
        {/* Native button (not the Button component): the dropdown trigger
            needs aria-expanded/aria-haspopup, which Button does not pass
            through. Same pass-btn classes, same track size. */}
        <button
          type="button"
          className="pass-btn pass-x-chip"
          data-variant="secondary"
          data-size="md"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="pass-x-handle">@{me.handle}</span>
        </button>
        {open ? (
          <span className="pass-x-dropdown" role="menu" aria-label="X identity">
            <button
              type="button"
              role="menuitem"
              className="pass-x-dropdown-item"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? "Disconnecting…" : "Disconnect X"}
            </button>
            {failed ? (
              <span className="pass-validation" role="alert">
                Could not disconnect X.
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export default XIdentityControl;
