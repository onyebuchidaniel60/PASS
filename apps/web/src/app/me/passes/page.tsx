import { OnboardingRedirectGuard } from "@/components/OnboardingRedirectGuard";
import { MyPassesClient } from "./MyPassesClient";

export const dynamic = "force-dynamic";

/**
 * §10.8 renders on the client because every state is a value returned by
 * `useAuthenticatedResource` and branched on by the pure `AuthenticatedView`.
 * The route itself is a thin shell — see the refactor that made this possible.
 */
export default function MyPassesPage() {
  return (
    <>
      {/* Layer 2: an authenticated user with no profile belongs in onboarding. */}
      <OnboardingRedirectGuard />
      <MyPassesClient />
    </>
  );
}