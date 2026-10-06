import type { Metadata } from "next";

import { TraderProfileClient } from "./TraderProfileClient";

/**
 * §10.4 / D-019.3. The public Trader profile is served at `/u/{slug}`, which is
 * the URL the Chrome extension emits from its `View Pass` handoff, so this route
 * is the extension's destination and must stay live.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `PASS — @${slug}`,
    description: "Published Passes, PASS performance, and reputation context.",
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <TraderProfileClient slug={slug} />;
}
