import { OnboardingRedirectGuard } from "@/components/OnboardingRedirectGuard";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

/** §10.10: every state is a value from `useAuthenticatedResource`. */
export default function SettingsPage() {
  return (
    <>
      {/* Layer 2 of the onboarding routing. `/settings` IS the onboarding entry
          for a signed-in user with no profile, so the guard and the
          `?x=connected` notice both belong on this page rather than on
          `/onboarding` — which must never redirect to itself. */}
      <OnboardingRedirectGuard />
      <SettingsClient />
    </>
  );
}
