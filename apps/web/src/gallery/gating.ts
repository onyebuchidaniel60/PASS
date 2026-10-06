/**
 * Gallery gating.
 *
 * design/DESIGN.md §10.15 and design/FRONTEND_IMPLEMENTATION_PLAN.md §3 Wave 1:
 * the gallery is a development verification surface and is gated out of
 * production. SKILL_FRONTEND_DESIGN.md §12, Phase 4 records that the gating must
 * be VERIFIED both anonymously and signed in, not assumed — an ungated dev route
 * is how a gallery leaks into a shipped build, and nothing else catches it.
 *
 * Kept in its own module so both branches are testable. A gate written inline in
 * the page component can only be exercised in whichever environment the test
 * happens to run in, which is how an unverified gate becomes a shipped one.
 */

/**
 * The gallery is enabled in development only.
 *
 * Reads NODE_ENV at call time rather than at module load so a test can exercise
 * both branches in one process without module-cache gymnastics.
 */
export function isGalleryEnabled(env: string | undefined = process.env.NODE_ENV): boolean {
  return env === "development";
}
