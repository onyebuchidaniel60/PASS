/**
 * Test setup for the PASS web app.
 *
 * Registers the jest-dom matchers, which is what lets a test assert
 * `toHaveAccessibleName`, `toBeInTheDocument`, and `toHaveAttribute` on
 * rendered elements rather than on raw DOM properties. Those assertions are
 * the substance of the component contract in
 * design/FRONTEND_IMPLEMENTATION_PLAN.md §2.4: an icon-only control must carry
 * an accessible name, and that is a query-level fact, not a string comparison.
 */
import "@testing-library/jest-dom/vitest";

/**
 * jsdom does not implement matchMedia, and every motion helper reads the
 * reduced-motion setting through it. Without a stub, any helper that consults
 * the setting throws rather than taking the reduced path, which would mean the
 * reduced-motion assertions could never be written.
 *
 * Default is motion ALLOWED. A test that needs the reduced path sets it
 * explicitly, so a test cannot pass by accident because the environment
 * happened to report reduced motion.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
