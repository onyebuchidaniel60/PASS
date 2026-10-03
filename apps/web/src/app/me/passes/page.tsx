import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyBlock, ErrorBlock, Panel, StatusChip } from "@pass/ui";
import { apiGetAs } from "@/lib/api";
import { fmtPrice, fmtUtc, relative, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Mine {
  passes: {
    id: string;
    publicId: string;
    status: string;
    asset: string;
    direction: string;
    entryPrice: string | null;
    takeProfit: string | null;
    stopLoss: string | null;
    leverage: string | null;
    publishedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  }[];
}

export default async function MyPassesPage() {
  const jar = await cookies();
  const cookieHeader = jar.toString();

  let data: Mine;
  try {
    data = await apiGetAs<Mine>("/api/v1/me/passes?limit=100", cookieHeader);
  } catch {
    redirect("/settings");
  }

  const counts = data.passes.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Passes</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Passes you have authored, with their lifecycle state.
          </p>
        </div>
        <Link
          href="/passes/new"
          className="rounded border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white no-underline"
        >
          Create a Pass
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {["draft", "active", "entry_pending", "open", "tp_hit"].map((s) => (
          <div key={s} className="rounded border border-neutral-200 p-3">
            <p className="font-mono text-xs uppercase tracking-wide text-neutral-500">
              {statusLabel(s)}
            </p>
            <p className="mt-1 font-mono text-2xl">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {data.passes.length === 0 ? (
        <EmptyBlock
          title="You have not published a Pass yet"
          body="A Pass turns a trade plan into a shareable, executable link."
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
          {data.passes.map((p) => (
            <li key={p.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/p/${p.publicId}`}
                  className="font-mono text-base font-medium no-underline hover:underline"
                >
                  {p.asset} {p.direction.toUpperCase()}
                </Link>
                <StatusChip label={statusLabel(p.status)} />
                <span className="ml-auto font-mono text-xs text-neutral-500">
                  {p.publishedAt ? relative(p.publishedAt) : `created ${relative(p.createdAt)}`}
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
                  <dt className="text-neutral-500">Expires</dt>
                  <dd>{p.expiresAt ? fmtUtc(p.expiresAt) : "—"}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <Panel title="Lifecycle">
        <p className="text-sm text-neutral-600">
          A published Pass is immutable in history. Editing an execution-relevant
          field creates a new version, and every execution stays bound to the
          version it reviewed.
        </p>
      </Panel>
    </div>
  );
}