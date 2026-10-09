import { OnboardingFlow } from "./OnboardingFlow";

export const dynamic = "force-dynamic";

/**
 * §10.11: one step per screen. The flow owns the step index — it starts at
 * the first incomplete step from `/me` and ends at the handoff — so the
 * router never has to track it and a refresh resumes where the user was.
 */
export default function OnboardingPage() {
  return <OnboardingFlow />;
}
