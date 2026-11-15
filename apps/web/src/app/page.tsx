import type { Metadata } from "next";

import { MarketingLandingView } from "./MarketingLandingView";

export const metadata: Metadata = {
  title: "PASS — See a trade. Know the trader. Take the trade.",
  description:
    "The chain-agnostic social execution layer built on NEAR Intents. Read the plan, fund from any chain, and execute on Hyperliquid without giving up your keys.",
};

/**
 * The public marketing landing page at `/`.
 *
 * This is the approved design that used to live at `/landing-mockup`. It owns
 * its own minimal header and footer, so the global application chrome is
 * suppressed while this route is mounted (the scoped rule lives in
 * styles/components.css).
 *
 * Signed-in visitors are sent to `/app` by `middleware.ts`; the page itself
 * stays static for logged-out traffic.
 */
export default function MarketingLandingPage() {
  return <MarketingLandingView />;
}
