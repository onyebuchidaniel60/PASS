import { OnboardingRedirectGuard } from "@/components/OnboardingRedirectGuard";
import { ExecutionsClient } from "./ExecutionsClient";

export const dynamic = "force-dynamic";

/** §10.9: every state is a value from `useAuthenticatedResource`. */
export default function ExecutionsPage() {
  return (
    <>
      {/* Layer 2: an authenticated user with no profile belongs in onboarding. */}
      <OnboardingRedirectGuard />
      <ExecutionsClient />
    </>
  );
}
