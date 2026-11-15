import type { Metadata } from "next";

import { LandingMockupView } from "./LandingMockupView";

export const metadata: Metadata = {
  title: "PASS — See a trade. Know the trader. Take the trade.",
  description:
    "The chain-agnostic social execution layer built on NEAR Intents. Read the plan, fund from any chain, and execute on Hyperliquid without giving up your keys.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Temporary design-review route for the next PASS landing page.
 *
 * This route is intentionally kept out of the primary navigation and is marked
 * noindex. The live homepage at `/` is untouched until the operator approves
 * this mockup. See `design/verify/screenshots/landing-mockup/`.
 */
export default function LandingMockupPage() {
  return <LandingMockupView />;
}
