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
 * THE FOUR STATES, all testable:
 *
 *   unknown    — renders NOTHING. `/me` is in flight and we do not know whether
 *                to offer "Sign in". Rendering the button first and hiding it a
 *                moment later is a visible flash on every single page load,
 *                and it is worse than an absent control because the user starts
 *                reaching for a button that is about to move.
 *   signed out — "Sign in with X". Same 302 as the backend route, so the flow
 *                begins server-side and PKCE/state are minted where the secret
 *                configuration lives.
 *   connected  — a §14.9 chip in the data face (a handle is DATA, §11.6), with a
 *                menu: view profile, settings, disconnect.
 *   error      — treated as signed out. A control that shows "disconnected" when
 *                the truth is "we could not tell" is a small lie that produces
 *                a confusing sign-in loop.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/wave2/controls";
import { clientGet, clientPost } from "@/lib/client";
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
    return { connected: true, handle: entry.handle, displayOnly: entry.displayOnly };
  }
  return SIGNED_OUT;
}

export function XIdentityControl() {
  // `null` = unknown (still loading). Deliberately not `false`, because
  // "not loaded" and "loaded and signed out" must not render the same thing.
  const [me, setMe] = useState<MeIdentity | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    const onPointer = (ev: PointerEvent) => {
      const node = menuRef.current;
      if (node && ev.target instanceof Node && !node.contains(ev.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const disconnect = useCallback(async () => {
    setOpen(false);
    setBusy(true);
    try {
      // Caught, not left to propagate. The control has no error surface of its
      // own — adding one for a single failure would be more machinery than the
      // situation warrants — but swallowing it into an unhandled rejection is
      // worse, because it takes the whole test file down and, in a real page,
      // surfaces as a console error the user cannot act on.
      //
      // The outcome is still reported honestly: `load()` below re-reads /me, so
      // a failed delete leaves the chip connected, which is the truth.
      await clientPost("/api/v1/auth/x/disconnect").catch(() => undefined);
    } finally {
      // Re-read from the server rather than optimistically flipping local state:
      // if the delete partially failed, an optimistic update would show
      // "signed out" while X is still connected.
      await load();
      // Other open screens hold their own /me snapshot (Bug 2a). Tell them
      // to re-read rather than leaving them stale until a manual refresh.
      const { notifyMeChanged } = await import("@/lib/me-events");
      notifyMeChanged();
      setBusy(false);
    }
  }, [load]);

  // UNKNOWN: render nothing. See the state table above.
  if (me === null) return null;

  if (!me.connected || !me.handle) {
    return (
      <span className="pass-x" data-state="signed-out">
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
      </span>
    );
  }

  const handle = me.handle;

  return (
    <span className="pass-x" data-state="connected">
      <div className="pass-x-menu" ref={menuRef}>
        <button
          type="button"
          className="pass-x-chip"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          {/* §11.6 a handle is DATA, so mono. The hidden label carries the
              spoken form so this is announced "X account turnttfup99" rather
              than a bare "@handle". */}
          <span className="visually-hidden">{`X account ${handle}`}</span>
          <span aria-hidden="true" className="pass-x-handle">
            @{handle}
          </span>
        </button>

        {open ? (
          <div className="pass-x-dropdown" role="menu" aria-label="X account">
            <p className="pass-x-dropdown-note">
              Connected as <span className="pass-x-handle">@{handle}</span>
              {me.displayOnly ? " (display only)" : null}
            </p>

            {/* §14.9 the Trader profile route is /u/{handle} (D-019.3). */}
            <Link className="pass-wallet-item" href={`/u/${handle}`} role="menuitem">
              View profile
            </Link>

            <Link className="pass-wallet-item" href="/settings" role="menuitem">
              Settings
            </Link>

            <button
              type="button"
              className="pass-wallet-item pass-wallet-item-danger"
              role="menuitem"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? "Disconnecting…" : "Disconnect X"}
            </button>
          </div>
        ) : null}
      </div>
    </span>
  );
}

export default XIdentityControl;
