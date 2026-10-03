import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyBlock, Panel, Rule, StatusChip } from "@pass/ui";
import { apiGet } from "@/lib/api";
import {
  fmtPrice,
  fmtUtc,
  relative,
  statusLabel,
  truncateAddress,
} from "@/lib/format";

export const dynamic = "force-dynamic";

interface Profile {
  slug: string;
  displayName: string;
  bio: string | null;
  xHandle: string | null;
  hyperliquidAccountAddress: string | null;
  connections: { provider: string; connected: boolean; label: string; displayOnly: boolean }[];
  performance: {
    takersCount: number;
    completedCount: number;
    tpHitCount: number;
    successRatePct: number | null;
  } | null;
  publishedPassCount: number;
  completedPassCount: number;
  activePassCount: number;
  reputation: {
    credibilityScore: number | null;
    reviewsCount: number | null;
    vouchesCount: number | null;
    humanVerified: boolean | null;
    sourceUrl: string | null;
    disclaimer: string;
  } | null;
}

interface PassRow {
  publicId: string;
  asset: string;
  direction: string;
  status: string;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  publishedAt: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await apiGet<Profile>(`/api/v1/profiles/${slug}`);
    return {
      title: `${p.displayName} — PASS`,
      description: p.bio ?? `Trade plans published by ${p.displayName} on PASS.`,
    };
  } catch {
    return { title: "Profile not found — PASS" };
  }
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let profile: Profile;
  let passes: PassRow[] = [];
  try {
    profile = await apiGet<Profile>(`/api/v1/profiles/${slug}`);
    const p = await apiGet<{ passes: PassRow[] }>(
      `/api/v1/profiles/${slug}/passes`,
    );
    passes = p.passes ?? [];
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
        {profile.xHandle && (
          <p className="font-mono text-sm text-neutral-600">@{profile.xHandle}</p>
        )}
        {profile.bio && <p className="max-w-prose text-neutral-700">{profile.bio}</p>}
        <ul className="mt-1 flex flex-wrap gap-2">
          {profile.connections.map((c) => (
            <li
              key={c.provider}
              className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs text-neutral-700"
            >
              {c.label}
            </li>
          ))}
        </ul>
        {profile.hyperliquidAccountAddress && (
          <p className="font-mono text-xs text-neutral-500">
            Hyperliquid {truncateAddress(profile.hyperliquidAccountAddress)}
          </p>
        )}
      </header>

      {/* Trading performance — PASS-owned only (D-014) */}
      <Panel title="Trading performance through PASS">
        <dl className="grid grid-cols-2 gap-4 font-mono sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Published</dt>
            <dd className="mt-1 text-2xl">{profile.publishedPassCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Completed</dt>
            <dd className="mt-1 text-2xl">{profile.completedPassCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">Active</dt>
            <dd className="mt-1 text-2xl">{profile.activePassCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-neutral-500">TP rate</dt>
            <dd className="mt-1 text-2xl">
              {profile.performance?.successRatePct === null ||
              profile.performance?.successRatePct === undefined
                ? "—"
                : `${profile.performance.successRatePct}%`}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-neutral-500">
          Outcomes of Passes published through PASS. Hyperliquid account-level
          performance is separate and is not evidence about any individual Pass.
        </p>
      </Panel>

      <Rule />

      {/* Reputation — external context, kept separate (D-007, D-014) */}
      {profile.reputation ? (
        <Panel title="Ethos reputation">
          <div className="font-mono">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Credibility score
            </p>
            <p className="mt-1 text-2xl">{profile.reputation.credibilityScore ?? "—"}</p>
            <p className="mt-2 text-xs text-neutral-600">
              reviews {profile.reputation.reviewsCount ?? "—"} · vouches{" "}
              {profile.reputation.vouchesCount ?? "—"} ·{" "}
              {profile.reputation.humanVerified ? "human verified" : "not human verified"}
            </p>
          </div>
          <Rule />
          <p className="mt-3 text-xs text-neutral-500">{profile.reputation.disclaimer}</p>
          {profile.reputation.sourceUrl && (
            <a
              href={profile.reputation.sourceUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="mt-2 inline-block text-sm"
            >
              View on Ethos
            </a>
          )}
        </Panel>
      ) : (
        <Panel title="Ethos reputation">
          <p className="text-sm text-neutral-500">
            No Ethos reputation has been resolved for this Trader.
          </p>
        </Panel>
      )}

      <section>
        <h2 className="text-lg font-semibold">Active Passes</h2>
        {passes.filter((p) => p.status === "active" || p.status === "entry_pending")
          .length === 0 ? (
          <div className="mt-3">
            <EmptyBlock title="No active Passes" />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-200 border border-neutral-200">
            {passes
              .filter((p) => p.status === "active" || p.status === "entry_pending")
              .map((p) => (
                <li key={p.publicId} className="flex flex-wrap items-center gap-3 p-4">
                  <Link
                    href={`/p/${p.publicId}`}
                    className="font-mono text-base font-medium no-underline hover:underline"
                  >
                    {p.asset} {p.direction.toUpperCase()}
                  </Link>
                  <StatusChip label={statusLabel(p.status)} />
                  <span className="ml-auto font-mono text-xs text-neutral-500">
                    entry {fmtPrice(p.entryPrice)} · TP {fmtPrice(p.takeProfit)} ·{" "}
                    {p.publishedAt ? relative(p.publishedAt) : ""}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        Last read {fmtUtc(new Date().toISOString())}
      </p>
    </div>
  );
}