"use client";

/**
 * TourGate — shows the one-time tour (D-022), mounted once in the root
 * layout beside `OnboardingGate`.
 *
 * Show rule, from `ready` state only: signed in, profile complete,
 * `tourCompletedAt` null, and not on `/onboarding` (the flow has its own
 * handoff; the tour must not cover it). Skip and Done both record
 * completion via the existing `PATCH /profiles/me`, then reload — the gate
 * hides on the re-read, so a refresh never re-shows.
 */

import { usePathname } from "next/navigation";

import { useAuthenticatedResource } from "@/lib/useAuthenticatedResource";
import type { MePayload } from "@/lib/me";
import { Tour } from "./Tour";

export function TourGate() {
  const pathname = usePathname();
  const { state, reload } = useAuthenticatedResource<MePayload>({
    load: async () => {
      const { clientGet } = await import("@/lib/client");
      return clientGet<MePayload>("/api/v1/me");
    },
  });

  if (state.status !== "ready") return null;
  if (!state.data.profileSlug) return null;
  if (state.data.tourCompletedAt) return null;
  if (pathname === "/onboarding" || pathname?.startsWith("/onboarding/") === true) {
    return null;
  }

  return (
    <Tour
      onDone={async () => {
        const { clientPatch } = await import("@/lib/client");
        await clientPatch("/api/v1/profiles/me", {
          tourCompletedAt: new Date().toISOString(),
        });
        reload();
      }}
    />
  );
}

export default TourGate;
