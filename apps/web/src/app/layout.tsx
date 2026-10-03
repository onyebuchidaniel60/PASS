import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoBanner } from "@pass/ui";

export const metadata: Metadata = {
  title: "PASS — See a trade. Know the trader. Take the trade.",
  description:
    "PASS turns Hyperliquid trade plans into shareable, executable links.",
};

const NAV = [
  { href: "/discover", label: "Discover" },
  { href: "/me/passes", label: "My Passes" },
  { href: "/me/executions", label: "Executions" },
  { href: "/settings", label: "Profile" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        <DemoBanner />
        <header className="border-b border-neutral-200">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight no-underline">
              PASS
            </Link>
            <ul className="flex flex-wrap items-center gap-4 text-sm">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="text-neutral-700 no-underline hover:text-neutral-900">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/passes/new"
                className="rounded border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm font-medium text-white no-underline hover:bg-neutral-800"
              >
                Create a Pass
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl border-t border-neutral-200 px-4 py-6 text-xs text-neutral-500">
          PASS is a social execution layer for Hyperliquid. You authorize your own
          orders with your own position size. Historical performance is not a
          guarantee of future results.
        </footer>
      </body>
    </html>
  );
}