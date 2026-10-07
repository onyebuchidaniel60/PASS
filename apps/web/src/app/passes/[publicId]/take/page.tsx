import type { Metadata } from "next";

import { clientGet } from "@/lib/client";

import { TakeFlowClient } from "./TakeFlowClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  return { title: `PASS — Take Pass ${publicId}` };
}

/**
 * The Pass is fetched server-side so step 1 renders with the plan already in
 * view. The size field is still EMPTY: the Taker's size is theirs to enter and
 * is never seeded from the Trader's (D-015).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  let pass: unknown;
  try {
    pass = await clientGet(`/api/v1/passes/${publicId}`);
  } catch {
    pass = null;
  }

  if (!pass) {
    const { notFound } = await import("next/navigation");
    notFound();
  }

  return <TakeFlowClient publicId={publicId} initialPass={pass as never} />;
}