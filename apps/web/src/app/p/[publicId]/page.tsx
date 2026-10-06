import type { Metadata } from "next";

import { PassDetailClient } from "./PassDetailClient";

/**
 * §10.14 social preview. Compact figures are used HERE and in headline
 * contexts only, never in the execution review (§10.14).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  return {
    title: `PASS — Pass ${publicId}`,
    description:
      "A trader-authored Hyperliquid trade plan. Inspect the trader, inspect the plan, take it with your own position size.",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <PassDetailClient publicId={publicId} />;
}
