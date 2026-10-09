"use client";

import { useCallback, useEffect, useState } from "react";

import { clientGet } from "@/lib/client";
import { onMeChanged } from "@/lib/me-events";
import type { MePayload } from "@/lib/me";

/**
 * Shared `/me` read for screens whose primary resource is NOT `/me`
 * (My Passes, Executions). Returns the payload or null when unknown, and
 * re-reads whenever another surface mutates connection state (Bug 2a).
 *
 * Null is fail-open by contract: these lists belong to the session's
 * user_id, so an unreadable snapshot must not hide them. Callers gate
 * account-attributed UI on the single-state selectors in `@/lib/me`
 * only when `me` is non-null.
 */
export function useMePayload(): { me: MePayload | null; reloadMe: () => void } {
  const [me, setMe] = useState<MePayload | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reloadMe = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const data = await clientGet<MePayload>("/api/v1/me");
        if (live) setMe(data);
      } catch {
        if (live) setMe(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [attempt]);

  useEffect(() => onMeChanged(reloadMe), [reloadMe]);

  return { me, reloadMe };
}
