import Link from "next/link";
import { Eyebrow } from "@pass/ui";

/** docs/PRODUCT_PRD.md §18 — landing messaging is fixed by the PRD. */
const LOOP = [
  "X post",
  "Pass",
  "Trader context",
  "Trade plan",
  "Hyperliquid",
];

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="py-6">
        <Eyebrow>PASS</Eyebrow>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          See a trade. Know the trader. Take the trade.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-700">
          PASS turns Hyperliquid trade plans into shareable, executable links.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/discover"
            className="rounded border border-neutral-900 bg-neutral-900 px-5 py-3 font-medium text-white no-underline hover:bg-neutral-800"
          >
            Explore Passes
          </Link>
          <Link
            href="/passes/new"
            className="rounded border border-neutral-300 bg-white px-5 py-3 font-medium text-neutral-900 no-underline hover:bg-neutral-50"
          >
            Create a Pass
          </Link>
        </div>
      </section>

      <section>
        <Eyebrow>The loop</Eyebrow>
        <ol className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {LOOP.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded border border-neutral-300 px-2 py-1 font-mono">
                {step}
              </span>
              {i < LOOP.length - 1 && <span className="text-neutral-400">&rarr;</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="text-sm font-semibold">You choose the size</h2>
          <p className="mt-1 text-sm text-neutral-600">
            A Pass is a plan, not an instruction. You pick your own position
            size and authorize your own order.
          </p>
        </div>
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="text-sm font-semibold">Nothing is custodied</h2>
          <p className="mt-1 text-sm text-neutral-600">
            PASS never asks for a seed phrase or master key, and never holds a
            signing key.
          </p>
        </div>
        <div className="rounded border border-neutral-200 p-4">
          <h2 className="text-sm font-semibold">Reputation stays separate</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Ethos reputation and trading performance are shown as distinct
            facts, never merged into one score.
          </p>
        </div>
      </section>
    </div>
  );
}