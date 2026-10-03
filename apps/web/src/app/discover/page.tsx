import Link from "next/link";
import { EmptyBlock, ErrorBlock, Eyebrow, StatusChip } from "@pass/ui";
import { apiGet } from "@/lib/api";
import { fmtPrice, relative, statusLabel } from "@/lib/format";

interface DiscoverPass {
  publicId: string;
  asset: string;
  direction: string;
  status: string;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  leverage: string | null;
  publishedAt: string | null;
}

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  let passes: DiscoverPass[] = [];
  let failed = false;

  try {
    const data = await apiGet<{ passes: DiscoverPass[] }>("/api/v1/discover?limit=40");
    passes = data.passes ?? [];
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Discover</h1>
        <ErrorBlock
          title="Could not load Passes"
          body="The PASS API is unavailable right now."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Discover</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold">Active and closed Passes</h1>
        </div>
        <p className="font-mono text-sm text-neutral-500">{passes.length} shown</p>
      </div>

      {passes.length === 0 ? (
        <EmptyBlock
          title="No Passes published yet"
          body="Be the first to publish a trade plan."
          action={
            <Link
              href="/passes/new"
              className="rounded border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white no-underline"
            >
              Create a Pass
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 border border-neutral-200">
          {passes.map((p) => (
            <li key={p.publicId} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/p/${p.publicId}`}
                  className="font-mono text-lg font-semibold text-neutral-900 no-underline hover:underline"
                >
                  {p.asset}{" "}
                  <span className="text-neutral-600">{p.direction.toUpperCase()}</span>
                </Link>
                <StatusChip label={statusLabel(p.status)} />
                <span className="ml-auto font-mono text-xs text-neutral-500">
                  {p.publishedAt ? relative(p.publishedAt) : "unpublished"}
                </span>
              </div>
              <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-neutral-700">
                <div className="flex gap-2">
                  <dt className="text-neutral-500">Entry</dt>
                  <dd>{fmtPrice(p.entryPrice)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-neutral-500">TP</dt>
                  <dd>{fmtPrice(p.takeProfit)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-neutral-500">SL</dt>
                  <dd>{fmtPrice(p.stopLoss)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-neutral-500">Lev</dt>
                  <dd>{p.leverage ?? "—"}x</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}