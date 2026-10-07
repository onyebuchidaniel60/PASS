import type { Metadata } from "next";

import { apiGet, ApiError } from "@/lib/api";

import { ErrorBlock } from "@/components/wave3/data";

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
 *
 * Uses the SERVER client, not `@/lib/client`. That module is marked
 * "use client", so calling it from a server component does not perform a
 * server-side fetch — which is why this route answered 404 in production while
 * every other route worked.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  let pass: unknown;
  let failed = false;
  try {
    pass = await apiGet(`/api/v1/passes/${publicId}`);
  } catch (e) {
    // A Pass that genuinely does not exist is a 404. Anything else — the API
    // unreachable, a bad response — is a failure of this page, and 404ing on it
    // would tell the user their Pass does not exist when it does.
    if (e instanceof ApiError && e.status === 404) {
      const { notFound } = await import("next/navigation");
      notFound();
    }
    failed = true;
  }

  if (failed || !pass) {
    return (
      <>
        <ErrorBlock
          title="Could not load this Pass."
          detail="The plan could not be read, so it cannot be taken safely."
        />
      </>
    );
  }

  return <TakeFlowClient publicId={publicId} initialPass={pass as never} />;
}