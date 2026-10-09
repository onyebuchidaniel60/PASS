"use client";

/**
 * Redirects an authenticated user with no PASS profile to `/onboarding`.
 *
 * WHY A GUARD IS NEEDED ALONGSIDE THE CALLBACK ROUTING
 *
 * The X callback now sends a profile-less user to `/onboarding` (Layer 1). That
 * only helps users who connect X AFTER that change existed. Anyone who already
 * connected X — including the operator's own account — is holding a session
 * with no profile and will land wherever they clicked, seeing a half-built
 * product. Layer 2 catches them.
 *
 * WHY IT IS NOT A GLOBAL MIDDLEWARE
 *
 * A blanket redirect would be wrong in both directions: it would fight the
 * callback's own redirect, it would intercept `/onboarding` itself and loop, and
 * it would fire on public routes where there is no profile by design. So it is a
 * hook mounted only by the authenticated screens that need it, and it excludes
 * `/onboarding` by construction.
 *
 * LOOP SAFETY
 *
 * The destination is never itself guarded, and the redirect only fires from
 * `ready` state — i.e. after `/me` has actually confirmed a session AND
 * reported no profile slug. It cannot fire on `/onboarding`, so it cannot bounce.
 *
 * `router.replace`, not `push`: the route the user asked for should not sit in
 * the back stack, or Back returns them here and straight back again.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";

interface Me {
  profileSlug: string | null;
}

export function OnboardingRedirectGuard() {
  const router = useRouter();

  const { state } = useAuthenticatedResource<Me>({
    load: async () => {
      const { clientGet } = await import("@/lib/client");
      return clientGet<Me>("/api/v1/me");
    },
  });

  useEffect(() => {
    // Only `ready` is actionable. `loading` means we do not know yet, and
    // redirecting on a guess would bounce a user who has a profile.
    if (state.status !== "ready") return;
    if (state.data.profileSlug) return;

    router.replace("/onboarding");
  }, [state, router]);

  // Renders nothing. This is a navigation side effect, not a view, and showing
  // a placeholder would flash on every authenticated page load.
  return null;
}

export default OnboardingRedirectGuard;
