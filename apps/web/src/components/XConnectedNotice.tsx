"use client";

/**
 * Acknowledges `?x=connected` — and its failure siblings — on return from the
 * OAuth round trip.
 *
 * WHY THIS NEEDS TO EXIST
 *
 * The callback ends at `reply.redirect('/settings?x=connected')`. That query
 * param is the ONLY evidence the user has that anything happened: the browser
 * made a cross-origin round trip to X and came back, and the visual result of a
 * successful sign-in and a complete no-op is otherwise identical.
 *
 * Two rules that are easy to get wrong:
 *
 *  1. The param is REMOVED with `replaceState`, not `pushState`. Leaving it in
 *     the URL means a refresh re-runs the acknowledgement, so the confirmation
 *     reappears minutes later and starts reading as stale or stuck. `replace`
 *     also keeps this out of the back-button history: pressing Back should not
 *     replay a sign-in that already happened.
 *
 *  2. The message is read BEFORE the param is stripped, because after stripping
 *     there is nothing left to read.
 *
 * Rendered inline rather than as a toast: the app has no toast system, and
 * adding one for a single message would be a framework decision this screen
 * does not get to make.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";
import { xConnection, type MePayload } from "@/lib/me";

type Notice = { tone: "ok" | "bad"; text: string } | null;

export function XConnectedNotice() {
  const params = useSearchParams();
  const [notice, setNotice] = useState<Notice>(null);

  /**
   * `/me` is read only to name the handle in the confirmation. If it fails the
   * message still has to render — "X connected" is true regardless of whether
   * we can spell out which account — so the catch is deliberately non-fatal.
   */
  const { state } = useAuthenticatedResource<MePayload>({
    load: async () => (await import("@/lib/client")).clientGet<MePayload>("/api/v1/me"),
  });

  const status = params?.get("x") ?? null;

  useEffect(() => {
    if (!status) return;

    void (async () => {
      if (status === "connected") {
        // The handle is a nicety, not the confirmation: if /me is still
        // loading or the entry is absent, "X connected." is honest on its
        // own. `xConnection` is total, so this read can never throw.
        const handle =
          state.status === "ready" ? (xConnection(state.data)?.handle ?? null) : null;
        setNotice({
          tone: "ok",
          text: handle ? `X connected as @${handle}.` : "X connected.",
        });
      } else if (status === "denied") {
        setNotice({ tone: "bad", text: "X authorization was declined." });
      } else if (status === "mock_pending") {
        setNotice({ tone: "ok", text: "X is in mock mode in this deployment." });
      }

      // Strip it either way, including for an unrecognised value: an unknown
      // `?x=` is not worth leaving in the URL for a refresh to re-process.
      stripParam();
    })();
    // Keyed on `status` alone, deliberately.
    //
    // Including `state` would re-run this on every /me transition and re-strip
    // the param, so the notice would flicker as /me resolves. The handle is
    // read from whatever `state` holds at the moment the status appears, and if
    // /me is still loading the message falls back to "X connected." without a
    // handle — which is honest and never wrong, because X HAS connected.
    //
    // `stripParam` is stable enough (declared in the component body, so a new
    // reference each render) that it cannot be a dependency here without
    // looping; the effect only needs to fire when `status` changes.
  }, [status]);

  function stripParam() {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("x");
    // Nothing else is dropped: the rest of the query is someone else's.
    window.history.replaceState(window.history.state, "", url.toString());
  }

  if (!notice) return null;

  return (
    <p
      className="pass-notice"
      data-tone={notice.tone}
      role="status"
      // Announced on mount so a screen-reader user learns the sign-in worked
      // without having to go looking for the chip.
      aria-live="polite"
    >
      {notice.text}
    </p>
  );
}

export default XConnectedNotice;
