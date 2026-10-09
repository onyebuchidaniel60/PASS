"use client";

/**
 * OnboardingGate — the SINGLE first-visit gate, mounted once in the root
 * layout. It replaces the scattered per-page `OnboardingRedirectGuard`
 * mounts (which covered only /settings, /me/passes and /me/executions and
 * left every other route unguarded).
 *
 * The rule, evaluated from `ready` state only (never on a guess):
 *
 * - on `/onboarding`: signed out → `/`; profile complete → `/discover`;
 *   otherwise stay.
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
import type { MePayload } from "@/lib/me";

interface MeSlug {
  profileSlug: string | null;
}

export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();

  const { state } = useAuthenticatedResource<MeSlug>({
    load: async () => {
      const { clientGet } = await import("@/lib/client");
      return clientGet<MePayload>("/api/v1/me");
    },
  });

  useEffect(() => {
    const onOnboarding =
      pathname === "/onboarding" || pathname?.startsWith("/onboarding/") === true;

    if (state.status === "unauthorized") {
      // Signed-out visitors may read anything public, except the flow
      // itself, which needs a session to do anything.
      if (onOnboarding) router.replace("/");
      return;
    }

    // Only `ready` beyond this point. `loading` means we do not know yet,
    // and redirecting on a guess would bounce users who are fine.
    if (state.status !== "ready") return;

    if (onOnboarding) {
      // A complete user re-opening the flow is done already.
      if (state.data.profileSlug) router.replace("/discover");
      return;
    }

    if (!state.data.profileSlug) {
      router.replace("/onboarding");
    }
  }, [state, pathname, router]);

  return null;
}

export default OnboardingGate;
