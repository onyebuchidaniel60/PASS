import type { Metadata } from "next";

import { clientGet } from "@/lib/client";

import { PassDetailClient } from "./PassDetailClient";

/**
 * §10.14 Social preview. This is the metadata X renders inside a share card,
 * not a user-facing screen.
 *
 * Spec format:
 *   PASS / BTC LONG / @TraderX / Entry $113.4K • TP $116K • SL $111.9K
 *
 * Two rules from §10.14 that are easy to break:
 *  - Compact figure formatting is used HERE AND IN HEADLINE CONTEXTS ONLY,
 *    never in the execution review. The page body uses full precision.
 *  - No private account data. The Trader's Hyperliquid address, the Taker's
 *    size, and any execution detail are deliberately absent.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;

  let title = `PASS — Pass ${publicId}`;
  let description =
    "A trader-authored Hyperliquid trade plan. Inspect the trader, inspect the plan, take it with your own position size.";
  let ogTitle = title;
  let ogDescription = description;

  try {
    const p = (await clientGet<{
      asset: string;
      direction: string;
      entryPrice?: string;
      takeProfit?: string;
      stopLoss?: string;
      trader?: { xHandle?: string | null; handle?: string };
    }>(`/api/v1/passes/${publicId}`));

    const asset = (p.asset ?? "").toUpperCase();
    const dir = p.direction === "short" ? "SHORT" : "LONG";
    const handle = p.trader?.xHandle ?? p.trader?.handle ?? "";

    // Compact formatting is permitted in this context only (§10.14).
    const compact = (v?: string): string => {
      if (!v) return "—";
      const n = Number(v);
      if (!Number.isFinite(n)) return "—";
      const k = n / 1000;
      return k >= 1
        ? `$${k.toFixed(1).replace(/\.0$/, "")}K`
        : `$${n.toFixed(0)}`;
    };

    title = `PASS — ${asset} ${dir}`;
    ogTitle = `PASS — ${asset} ${dir}`;
    // The standalone description is the handle alone: the card line carries the
    // plan, and the two together match the spec's four-line shape without
    // repeating the asset in both places.
    description = handle ? `@${handle}` : ogDescription;
    ogDescription =
      `${asset} ${dir} · @${handle} · ` +
      `Entry ${compact(p.entryPrice)} • TP ${compact(p.takeProfit)} • SL ${compact(p.stopLoss)}`;
  } catch {
    // A Pass that cannot be read still gets a usable card. The fallback above
    // names the Pass and says nothing false about it.
  }

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "article",
      siteName: "PASS",
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description: ogDescription,
    },
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
