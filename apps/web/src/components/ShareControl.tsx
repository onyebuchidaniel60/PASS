"use client";

import { useState } from "react";
import { Button } from "@pass/ui";
import { clientPost } from "@/lib/client";

/**
 * docs/API_CONTRACTS.md §5 — sharing. Copy-only always works; native X
 * posting is optional and its absence is never an error (Stage H gate).
 */
export function ShareControl({ passId }: { passId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function share(mode: "copy" | "post") {
    setBusy(true);
    setMsg(null);
    try {
      const r = await clientPost<{
        shareUrl: string;
        shareText: string;
        xPostId: string | null;
        copyOnly: boolean;
        reason?: string;
      }>("/api/v1/sharing/x", { passId, mode });

      if (r.xPostId) {
        setMsg("Posted to X.");
        return;
      }
      await navigator.clipboard.writeText(`${r.shareText}`);
      setMsg(
        r.copyOnly
          ? "Link and post text copied to your clipboard."
          : "Link and post text copied to your clipboard.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not prepare the share text.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => share("copy")}>
          Copy link
        </Button>
        <Button size="sm" disabled={busy} onClick={() => share("post")}>
          Share on X
        </Button>
      </div>
      {msg && (
        <p role="status" className="mt-2 text-xs text-neutral-600">
          {msg}
        </p>
      )}
    </div>
  );
}