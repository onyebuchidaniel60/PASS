import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileMenu } from "@/components/MobileMenu";
import { Providers } from "@/components/Providers";
import { OnboardingGate } from "@/components/OnboardingGate";
import { TopbarNav } from "@/components/TopbarNav";
import { TourGate } from "@/components/TourGate";
import { XIdentityControl } from "@/components/XIdentityControl";
import { Logo, LogoMark } from "@/components/reference/logo";
import { FOOTER_LINKS } from "@/lib/nav";

export const metadata: Metadata = {
  title: "PASS — See a trade. Know the trader. Take the trade.",
  description:
    "PASS turns Hyperliquid perp and prediction-market trade plans into shareable, executable links.",
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
 * auto`, so at narrow widths the identity control drifted toward the middle.
 * The three regions are now explicit grid tracks, so each is in its own column at
 * every width and the identity control is always hard right. (D-023 removed
 * the second actions-track control; the track keeps its non-shrinking column
 * so the layout does not need re-verification if a control returns.)
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* Single first-visit gate: profile-less sessions belong in
              onboarding, signed-out visitors never leave public routes. */}
          <OnboardingGate />
          {/* One-time tour (D-022): profile complete, never completed. */}
          <TourGate />
          <DemoBanner />
          <header className="pass-topbar">
            <nav className="pass-topbar-inner" aria-label="Primary">
              {/* `/` is the marketing page; the app chrome always returns to
                  the application home at `/app`, keeping the visitor inside the
                  product rather than bouncing them back to marketing. */}
              <Link href="/app" className="pass-wordmark" aria-label="PASS home">
                {/* §14.14. The app mark and wordmark are both SVG, so the
                    header is identical with no webfont loaded and the browser
                    tab uses the same mark. */}
                <span className="pass-brand-lockup">
                  <LogoMark size={26} />
                  <Logo
                    size={26}
                    title={null}
                    className="pass-wordmark-text"
                  />
                </span>
              </Link>

              <div className="pass-topbar-nav">
                <TopbarNav />
              </div>

              {/* §8.4 the actions track holds the global search and the X
                  identity. D-023: PASS identity is X-only — the handle is who
                  a Trader IS. The wallet is execution-only and connects lazily
                  at Take time, so it has no topbar presence. */}
              <div className="pass-topbar-actions">
                <GlobalSearch />
                <XIdentityControl />
                <MobileMenu />
              </div>
            </nav>
          </header>
          {/* PageShell inside each screen owns the main landmark. */}
          {children}
          <footer className="pass-footer">
            <div className="pass-footer-grid">
              <div className="pass-footer-brand">
                {/* The footer lockup mirrors the topbar exactly: the app mark
                    and the PASS wordmark sit on one baseline. The tagline is
                    the only line below them. */}
                <span className="pass-brand-lockup">
                  <LogoMark size={26} />
                  <Logo size={26} title={null} />
                </span>
                <p className="pass-stale">
                  Social execution for Hyperliquid, powered by NEAR Intents.
                </p>
              </div>
              <ul className="pass-footer-links">
                {FOOTER_LINKS.map((n) => (
                  <li key={n.href}>
                    {n.external ? (
                      <a
                        href={n.href}
                        className="pass-nav-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {n.label}
                      </a>
                    ) : (
                      <Link href={n.href} className="pass-nav-link">
                        {n.label}
                      </Link>
                    )}
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
