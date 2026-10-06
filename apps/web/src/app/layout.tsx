import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoBanner } from "@pass/ui";
import { Providers } from "@/components/Providers";
import { ConnectWalletEntry } from "@/components/ApproveAgentControl";

export const metadata: Metadata = {
  title: "PASS — See a trade. Know the trader. Take the trade.",
  description:
    "PASS turns Hyperliquid trade plans into shareable, executable links.",
};

/**
 * UX_SPEC §3 global navigation: Discover · My Passes · Executions · Profile.
 * There is deliberately no Dashboard — DESIGN.md §10.8 defines one "My Passes
 * (dashboard)" screen, and adding a fifth destination would change product
 * navigation the spec does not define (gap G-16).
 */
const NAV = [
  { href: "/discover", label: "Discover" },
  { href: "/me/passes", label: "My Passes" },
  { href: "/me/executions", label: "Executions" },
  { href: "/settings", label: "Profile" },
];

/**
 * Public shell — DESIGN.md §8.4: sticky top bar with a hairline bottom border.
 *
 * Rebuilt on tokens. The previous shell was Tailwind utility classes on a white
 * background, which contradicted §2.7 (PASS is dark-only) and meant every
 * screen rendered light regardless of the token layer.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <DemoBanner />
          <header className="pass-topbar">
            <nav className="pass-topbar-inner" aria-label="Primary">
              <Link href="/" className="pass-wordmark">
                PASS
              </Link>
              <ul className="pass-nav">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="pass-nav-link">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="pass-topbar-actions">
                <ConnectWalletEntry />
              </div>
            </nav>
          </header>
          {/* PageShell inside each screen owns the main landmark. */}
          {children}
          <footer className="pass-footer">
            PASS is a social execution layer for Hyperliquid. You authorize your
            own orders with your own position size. Historical performance is not
            a guarantee of future results.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
