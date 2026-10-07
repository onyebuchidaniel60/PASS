import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoBanner } from "@pass/ui";
import { Providers } from "@/components/Providers";
import { ConnectWalletEntry } from "@/components/ApproveAgentControl";
import { Logo } from "@/components/reference/logo";
import { INFO, NAV } from "@/lib/nav";

export const metadata: Metadata = {
  title: "PASS — See a trade. Know the trader. Take the trade.",
  description:
    "PASS turns Hyperliquid trade plans into shareable, executable links.",
  icons: {
    // Next.js also picks up app/icon.svg on its own; naming it here makes the
    // browser-tab mark explicit rather than incidental.
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

/**
 * UX_SPEC §3 global navigation: Discover · My Passes · Executions · Profile, plus
 * the informational pages §14 requires.
 *
 * There is deliberately no Dashboard — DESIGN.md §10.8 defines one "My Passes
 * (dashboard)" screen, and adding a fifth destination would change product
 * navigation the spec does not define (gap G-16).
 *
 * §8.4 three-region shell. The operator reported "connect wallet is at the
 * centre instead of on one side", which was a real layout fault: the nav sat in
 * the flex flow and the actions were pushed right with `margin-inline-start:
 * auto`, so at narrow widths the wallet button drifted toward the middle. The
 * three regions are now explicit grid tracks, so each is in its own column at
 * every width and the wallet button is always hard right.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <DemoBanner />
          <header className="pass-topbar">
            <nav className="pass-topbar-inner" aria-label="Primary">
              <Link href="/" className="pass-wordmark" aria-label="PASS home">
                {/* §14.14. The wordmark is an SVG, not type, so the mark is
                    identical with no webfont loaded. */}
                <Logo size={26} title={null} />
              </Link>

              <div className="pass-topbar-nav">
                <ul className="pass-nav">
                  {NAV.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} className="pass-nav-link">
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pass-topbar-actions">
                <ConnectWalletEntry />
              </div>
            </nav>
          </header>
          {/* PageShell inside each screen owns the main landmark. */}
          {children}
          <footer className="pass-footer">
            <div className="pass-footer-grid">
              <div className="pass-footer-brand">
                <Logo size={22} title={null} />
                <p className="pass-stale">Social execution for Hyperliquid.</p>
              </div>
              <ul className="pass-footer-links">
                {NAV.concat(INFO).map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="pass-nav-link">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <p className="pass-footer-note">
              PASS is a social execution layer for Hyperliquid. You authorize your
              own orders with your own position size. Historical performance is not
              a guarantee of future results.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
