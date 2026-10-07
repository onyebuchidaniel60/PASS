import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

/** §10.11: one step per screen. `step` is owned by the router in the full flow. */
export default function OnboardingPage() {
  return <OnboardingClient />;
}
