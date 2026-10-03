import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EmptyBlock, StatusChip } from "@pass/ui";
import { apiGetAs } from "@/lib/api";
import { fmtPnl, fmtUtc, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ExecRow {
  id: string;
  passId: string;
  passVersion: number;
  providerOrderId: string | null;
  providerStatus: string;
  status: string;
  positionSize: string;
  realizedPnl: string | null;
  createdAt: string;
}

export default async function ExecutionsPage() {
  const jar = await cookies();
  let data: { executions: ExecRow[] };
  try {
    data = await apiGetAs<{ executions: ExecRow[] }>(
      "/api/v1/me/executions?limit=100",
      jar.toString(),
    );
  } catch {
    redirect("/settings");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executions</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Orders you authorized through PASS, bound to the exact Pass version you
          reviewed.
        </p>
      </div>

      {data.executions.length === 0 ? (
        <EmptyBlock
          title="No executions yet"
          body="Take a Pass to record an execution against your own Hyperliquid account."
        />
      ) : (
        <div className="overflow-x-auto border border-neutral-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                {["Pass", "Ver", "Size", "Provider order", "Provider status", "State", "Realized PnL", "When"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="px-3 py-2 font-mono text-xs uppercase tracking-wide text-neutral-600"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 font-mono">
              {data.executions.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2">
                    <a href={`/p/${e.passId}`} className="text-neutral-900">
                      {e.passId.slice(0, 8)}
                    </a>
                  </td>
                  <td className="px-3 py-2">{e.passVersion}</td>
                  <td className="px-3 py-2">{e.positionSize}</td>
                  <td className="px-3 py-2 text-xs">{e.providerOrderId ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{e.providerStatus}</td>
                  <td className="px-3 py-2">
                    <StatusChip label={statusLabel(e.status)} />
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      e.realizedPnl === null
                        ? "text-neutral-500"
                        : Number(e.realizedPnl) > 0
                          ? "text-emerald-700"
                          : Number(e.realizedPnl) < 0
                            ? "text-red-700"
                            : ""
                    }`}
                  >
                    {fmtPnl(e.realizedPnl)}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {fmtUtc(e.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Realized PnL is shown with its sign. Colour is a secondary cue only.
        Entry price and PnL from Hyperliquid are frontend-convenience values, not
        independently settled accounting facts.
      </p>
    </div>
  );
}