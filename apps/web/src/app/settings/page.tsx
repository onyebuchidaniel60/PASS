import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

/**
 * §10.10: every state is a value from `useAuthenticatedResource`.
 *
 * First-visit routing is owned by the single `OnboardingGate` in the root
 * layout, not by per-page guards.
 */
export default function SettingsPage() {
  return <SettingsClient />;
}
