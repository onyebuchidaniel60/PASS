import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow, Panel, Rule, StatusChip } from "@pass/ui";
import { apiGet, APP_URL } from "@/lib/api";
import {
  fmtCompact,
  fmtPrice,
  fmtUtc,
  relative,
  statusLabel,
  truncateAddress,
} from "@/lib/format";

export const dynamic = "force-dynamic";

interface PublicPass {
  publicId: string;
  asset: string;
  direction: string;
  status: string;
  version: number;
  entryType: string;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  leverage: string | null;
  thesis: string;
  publishedAt: string | null;
  expiresAt: string | null;
  trader: {
    slug: string;
    displayName: string;
    bio: string | null;
    xHandle: string | null;
    hyperliquidAccountAddress: string | null;
  };
  reputation: {
    credibilityScore: number | null;
    reviewsCount: number | null;
    vouchesCount: number | null;
    humanVerified: boolean | null;
    sourceUrl: string | null;
    syncedAt: string | null;
    disclaimer: string;
  } | null;
  market: { markPrice: string; observedAt: string } | null;
  performance: {
    takersCount: number;
    completedCount: number;
    tpHitCount: number;
    slHitCount: number;
    successRatePct: number | null;
  } | null;
}

async function load(publicId: string): Promise<PublicPass | null> {
  try {
    return await apiGet<PublicPass>(`/api/v1/passes/${publicId}`);
  } catch {
    return null;
  }
}

/** docs/UX_SPEC.md §14 — social preview metadata. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const pass = await load(publicId);
  if (!pass) return { title: "Pass not found — PASS" };

  const title = `${pass.asset} ${pass.direction.toUpperCase()}`;
  const bits = [
    pass.entryPrice ? `Entry $${fmtCompact(pass.entryPrice)}` : null,
    pass.takeProfit ? `TP $${fmtCompact(pass.takeProfit)}` : null,
    pass.stopLoss ? `SL $${fmtCompact(pass.stopLoss)}` : null,
  ].filter(Boolean);

  return {
    title: `${title} — PASS`,
    description: `${pass.trader.xHandle ? `@${pass.trader.xHandle}` : pass.trader.displayName} · ${bits.join(" • ")}`,
    openGraph: {
      title: `PASS — ${title}`,
      description: `${pass.trader.xHandle ? `@${pass.trader.xHandle}` : pass.trader.displayName} · ${bits.join(" • ")}`,
      url: `${APP_URL}/p/${pass.publicId}`,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `PASS — ${title}`,
      description: `${pass.trader.xHandle ? `@${pass.trader.xHandle}` : pass.trader.displayName} · ${bits.join(" • ")}`,
    },
  };
}

export default async function PassPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const pass = await load(publicId);
  if (!pass) notFound();

  const takable = pass.status === "active" || pass.status === "entry_pending";

  return (
    <div className="flex flex-col gap-6">
      {/* A. Status */}
      <header className="flex flex-col gap-2">
        <StatusChip label={statusLabel(pass.status)} />
        {/* B. Trade */}
        <h1 className="font-mono text-4xl font-semibold tracking-tight">
          {pass.asset}{" "}
          <span className="text-neutral-600">{pass.direction.toUpperCase()}</span>
        </h1>
        <p className="font-mono text-xs text-neutral-500">
          Pass version {pass.version} ·{" "}
          {pass.publishedAt ? `published ${relative(pass.publishedAt)}` : "not published"}
          {pass.expiresAt ? ` · expires ${fmtUtc(pass.expiresAt)}` : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* D. Plan */}
          <Panel title="Trade plan">
            <dl className="grid grid-cols-2 gap-4 font-mono sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Entry</dt>
                <dd className="mt-1 text-xl">{fmtPrice(pass.entryPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">TP</dt>
                <dd className="mt-1 text-xl">{fmtPrice(pass.takeProfit)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">SL</dt>
                <dd className="mt-1 text-xl">{fmtPrice(pass.stopLoss)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-neutral-500">Leverage</dt>
                <dd className="mt-1 text-xl">{pass.leverage ?? "—"}x</dd>
              </div>
            </dl>
            <p className="mt-4 font-mono text-xs text-neutral-500">
              Entry type: {pass.entryType}
            </p>
          </Panel>

          {/* E. Thesis */}
          <Panel title="Thesis">
            <p className="max-w-prose whitespace-pre-wrap text-neutral-800">
              {pass.thesis}
            </p>
          </Panel>

          {/* G. Takers / metrics — PASS-owned only */}
          {pass.performance && (
            <Panel title="Taken through PASS">
              <dl className="grid grid-cols-2 gap-4 font-mono sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Takers</dt>
                  <dd className="mt-1 text-xl">{pass.performance.takersCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">Completed</dt>
                  <dd className="mt-1 text-xl">{pass.performance.completedCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">TP hit</dt>
                  <dd className="mt-1 text-xl">{pass.performance.tpHitCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-neutral-500">TP rate</dt>
                  <dd className="mt-1 text-xl">
                    {pass.performance.successRatePct === null
                      ? "—"
                      : `${pass.performance.successRatePct}%`}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs text-neutral-500">
                Outcomes recorded for this Pass only. Not the Trader&apos;s account
                performance.
              </p>
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {/* C. Trader */}
          <Panel title="Trader">
            <p className="font-medium text-neutral-900">
              {pass.trader.xHandle ? `@${pass.trader.xHandle}` : pass.trader.displayName}
            </p>
            {pass.trader.bio && (
              <p className="mt-1 text-sm text-neutral-600">{pass.trader.bio}</p>
            )}
            <div className="mt-3">
              <Link
                href={`/u/${pass.trader.slug}`}
                className="text-sm text-neutral-900 no-underline hover:underline"
              >
                View profile &rarr;
              </Link>
            </div>
            {pass.trader.hyperliquidAccountAddress && (
              <p className="mt-3 font-mono text-xs text-neutral-500">
                Hyperliquid{" "}
                {truncateAddress(pass.trader.hyperliquidAccountAddress)}
              </p>
            )}
          </Panel>

          {/* F. Market context */}
          <Panel title="Market">
            {pass.market ? (
              <div className="font-mono">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Mark / mid</p>
                <p className="mt-1 text-2xl">{fmtPrice(pass.market.markPrice)}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {fmtUtc(pass.market.observedAt)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                Market data is unavailable right now.
              </p>
            )}
          </Panel>

          {/* Ethos reputation — separate block, never merged with performance */}
          {pass.reputation && (
            <Panel title="Ethos reputation">
              <div className="font-mono">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Credibility score
                </p>
                <p className="mt-1 text-2xl">
                  {pass.reputation.credibilityScore ?? "—"}
                </p>
                <p className="mt-2 text-xs text-neutral-600">
                  reviews {pass.reputation.reviewsCount ?? "—"} · vouches{" "}
                  {pass.reputation.vouchesCount ?? "—"} ·{" "}
                  {pass.reputation.humanVerified ? "human verified" : "not human verified"}
                </p>
              </div>
              <Rule />
              <p className="mt-3 text-xs text-neutral-500">{pass.reputation.disclaimer}</p>
              {pass.reputation.sourceUrl && (
                <a
                  href={pass.reputation.sourceUrl}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="mt-2 inline-block text-sm"
                >
                  View on Ethos
                </a>
              )}
            </Panel>
          )}

          {/* H. CTA */}
          <div>
            {takable ? (
              <Link
                href={`/passes/${pass.publicId}/take`}
                className="flex min-h-[48px] w-full items-center justify-center rounded border border-neutral-900 bg-neutral-900 px-4 py-3 font-medium text-white no-underline hover:bg-neutral-800"
              >
                Take Pass
              </Link>
            ) : (
              <p className="rounded border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                This Pass is {statusLabel(pass.status).toLowerCase()} and cannot be
                taken.
              </p>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              You choose your own position size and authorize your own order.
              PASS never holds your keys.
            </p>
          </div>

          <Eyebrow>Canonical</Eyebrow>
          <p className="font-mono text-xs break-all text-neutral-500">
            {APP_URL}/p/{pass.publicId}
          </p>
        </aside>
      </div>
    </div>
  );
}