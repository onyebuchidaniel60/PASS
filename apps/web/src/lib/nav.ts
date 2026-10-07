/**
 * The product's navigation, in one place.
 *
 * It lives here rather than in `app/layout.tsx` because a Next.js App Router
 * layout may only export its own special exports; anything else is a type
 * error in the generated route types. Screens and the footer both need this
 * list, and neither should be able to drift from the topbar.
 */

export interface NavLink {
  href: string;
  label: string;
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

/** §14 informational pages. Not destinations of their own; reachable, but not
 *  in the four-item primary nav, which UX_SPEC §3 fixes. */
export const INFO: NavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/faqs", label: "FAQs" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
];
