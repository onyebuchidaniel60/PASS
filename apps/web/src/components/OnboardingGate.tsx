"use client";

/**
 * OnboardingGate — the SINGLE first-visit gate, mounted once in the root
 * layout. It replaces the scattered per-page `OnboardingRedirectGuard`
 * mounts (which covered only /settings, /me/passes and /me/executions and
 * left every other route unguarded).
 *
 * The rule, evaluated from `ready` state only (never on a guess):
 *
 * - on `/onboarding`: signed out → `/`; otherwise stay. The FLOW owns
 *   progression once signed in — it renders the first incomplete step from
 *   fresh `/me` and ends at the handoff, so the gate must never pull a
 *   mid-flow user forward: profile completion alone is not flow completion
 *   (Ethos follows), and yanking to `/discover` would skip the remaining
 *   step. A complete user re-opening the flow simply sees the handoff.
 * - anywhere else: signed in without a profile → `/onboarding`; otherwise
 *   stay (signed-out visitors and complete users are never intercepted).
 *
 * `router.replace`, not `push`: the intercepted route must not sit in the
 * back stack. The destination is never itself gated in a way that bounces:
 * `/onboarding` excludes itself by construction, and `/` + `/discover`
 * never redirect away.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";
import { onMeChanged } from "@/lib/me-events";
import type { MePayload } from "@/lib/me";

interface MeSlug {
  profileSlug: string | null;
}

/**
 * Routes that author and therefore require a session to render
 * anything useful. A signed-out visitor is sent to landing rather than
 * shown a form whose submit the API would refuse (Bug 1). The Take flow
 * is deliberately NOT listed: taking a Pass needs a wallet signature,
 * not a PASS session (D-026). Screens with their own unauthorized views
 * (/settings, /me/*) are NOT listed either: their PermissionBlock is the
 * established handling, asserted by their tests.
 */
const SESSION_ROUTES: Array<(pathname: string) => boolean> = [
  (p) => p === "/passes/new",
];

function requiresSession(pathname: string | null): boolean {
  if (!pathname) return false;
  return SESSION_ROUTES.some((match) => match(pathname));
}

export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();

  const { state, reload } = useAuthenticatedResource<MeSlug>({
    load: async () => {
      const { clientGet } = await import("@/lib/client");
      return clientGet<MePayload>("/api/v1/me");
    },
  });

  // The gate decides from its snapshot, so the snapshot must track
  // mutations: profile creation happens inside the flow (no remount, no
  // pathname change), and without this subscription the gate keeps
  // reporting onboarding-incomplete and bounces every client-side arrival
  // at /discover back to /onboarding — a redirect loop against the flow's
  // own handoff link. Same Bug 2a discipline as Settings.
  useEffect(() => onMeChanged(reload), [reload]);

  useEffect(() => {
    const onOnboarding =
      pathname === "/onboarding" || pathname?.startsWith("/onboarding/") === true;

    if (state.status === "unauthorized") {
      // Signed-out visitors may read anything public and may take a Pass
      // with their wallet (D-026) — only the authoring routes, whose forms
      // would fail at submit (Bug 1), redirect.
      if (onOnboarding || requiresSession(pathname)) router.replace("/");
      return;
    }

    // Only `ready` beyond this point. `loading` means we do not know yet,
    // and redirecting on a guess would bounce users who are fine.
    if (state.status !== "ready") return;

    if (onOnboarding) {
      // Signed-in users stay: the flow renders the first incomplete step
      // (or the handoff) from its own fresh read. Redirecting a
      // profile-complete user forward here would fire mid-flow — right
      // after profile creation, while the Ethos step is still ahead —
      // and skip the remaining step.
      return;
    }

    if (!state.data.profileSlug) {
      router.replace("/onboarding");
    }
  }, [state, pathname, router]);

  return null;
}

export default OnboardingGate;
