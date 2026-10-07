import type { Metadata } from "next";

import { StalePassClient } from "./StalePassClient";

/**
 * §10.7 Stale Pass interstitial as its own route.
 *
 * UX_SPEC §9: when a Pass changes after the page loaded, or the market
 * invalidates the plan, this replaces the page. It is a route rather than only
 * a modal state so it can be LINKED to — a share or a retry can point at it
 * directly — and so it can be exercised in isolation.
 */
export const metadata: Metadata = {
  title: "PASS — This Pass changed",
};

export default async function Page({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <StalePassClient publicId={publicId} />;
}