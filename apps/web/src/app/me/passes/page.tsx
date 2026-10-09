import { MyPassesClient } from "./MyPassesClient";

export const dynamic = "force-dynamic";

/**
 * §10.8 renders on the client because every state is a value returned by
 * `useAuthenticatedResource` and branched on by the pure `AuthenticatedView`.
 * The route itself is a thin shell — see the refactor that made this possible.
 *
 * First-visit routing is owned by the single `OnboardingGate` in the root
 * layout, not by per-page guards.
 */
export default function MyPassesPage() {
  return <MyPassesClient />;
}
