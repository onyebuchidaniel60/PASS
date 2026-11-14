/**
 * The product's navigation, in one place.
 *
 * It lives here rather than in `app/layout.tsx` because a Next.js App Router
 * layout may only export its own special exports; anything else is a type
 * error in the generated route types. Screens use NAV/INFO; the footer uses
 * FOOTER_LINKS, so the primary navigation and the legal links cannot drift.
 */

export interface NavLink {
  href: string;
  label: string;
  /** External destinations open in a new tab and carry rel=noopener. */
  external?: boolean;
}

/**
 * UX_SPEC §3 global navigation: Discover · My Passes · Executions · Profile.
 *
 * There is deliberately no Dashboard. DESIGN.md §10.8 defines one "My Passes
 * (dashboard)" screen, and adding a fifth destination would change product
 * navigation the spec does not define (gap G-16).
 */
export const NAV: NavLink[] = [
  { href: "/discover", label: "Discover" },
  { href: "/me/passes", label: "My Passes" },
  { href: "/me/executions", label: "Executions" },
  { href: "/settings", label: "Profile" },
];

/** §14 informational pages used by the landing chip bar and the contact page.
 *  Not destinations of their own; not in the four-item primary nav. */
export const INFO: NavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/faqs", label: "FAQs" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
  // `/settings` is already the fourth item of NAV ("Profile"). `/onboarding`
  // is deliberately NOT linked from the informational pages: it is the target
  // of a redirect for users who have no profile, not a place to browse.
];

/**
 * Footer destinations. The primary nav is already in the topbar, so the footer
 * carries the professional/legal set instead of repeating Discover, My Passes,
 * Executions and Profile.
 */
export const FOOTER_LINKS: NavLink[] = [
  { href: "/docs", label: "Docs" },
  { href: "/developers", label: "Developers" },
  {
    href: "https://github.com/onyebuchidaniel60/PASS",
    label: "GitHub",
    external: true,
  },
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/contact", label: "Contact" },
];
