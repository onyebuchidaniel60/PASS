import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import GalleryPage from "./impl";
import { GalleryClient } from "./client";
import { isGalleryEnabled } from "./gating";
import { reducedMotionPreviewCss } from "@/motion";

/**
 * Gallery tests — design/DESIGN.md §10.15.
 *
 * The gating test is the one that matters most, and it is the one that caught a
 * real defect: an earlier runtime `return null` gate passed every assertion here
 * while still shipping the route and its source in a production build. Unit
 * tests cannot see build-time inclusion, so the build-level grep in
 * design/BUILD_CONTINUATION.md is part of this surface's verification and must be
 * repeated after any change to page.tsx.
 */
const ADDRESS = "0x7f3aC9b41E8d05A6f0B2c7E9d14A83f5C6b2D90E";

/**
 * Hoisted so `page.tsx`'s `notFound()` is observable. `vi.doMock` cannot do
 * this: the page module is statically imported, so it is already evaluated by the
 * time a doMock would run.
 */
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("gallery gating (§10.15)", () => {
  it("is enabled in development", () => {
    expect(isGalleryEnabled("development")).toBe(true);
  });

  it("is disabled in production", () => {
    expect(isGalleryEnabled("production")).toBe(false);
  });

  it("is disabled in test", () => {
    expect(isGalleryEnabled("test")).toBe(false);
  });

  it("is disabled when NODE_ENV is unset, failing closed", () => {
    expect(isGalleryEnabled(undefined)).toBe(false);
  });

  it("calls notFound() in production so the route leaves the build", () => {
    // notFound() throws NEXT_NOT_FOUND, which is what removes the route from a
    // production build. A returned null would only hide it at runtime, and the
    // route and its source would still ship — which is exactly what happened
    // before this was changed.
    vi.stubEnv("NODE_ENV", "production");
    expect(() => render(<GalleryPage />)).toThrow("NEXT_NOT_FOUND");
  });

  it("renders the gallery in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<GalleryPage />);
    expect(screen.getByText(/component gallery/i)).toBeInTheDocument();
  });
});

describe("gallery contents", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("renders every Wave 1 primitive at least once", () => {
    const { container } = render(<GalleryClient />);
    for (const cls of [
      ".pass-panel",
      ".pass-chamfer-panel",
      ".pass-stack",
      ".pass-inline",
      ".pass-section",
      ".pass-rule",
      ".pass-grid-field",
      ".pass-eyebrow",
      ".pass-section-number",
      ".pass-signal-line",
      ".pass-reticle",
      ".pass-coordinate-pair",
      ".pass-coordinate-grid",
      ".pass-page-shell",
    ]) {
      expect(container.querySelector(cls), cls).not.toBeNull();
    }
  });

  it("renders both ChamferPanel variants", () => {
    const { container } = render(<GalleryClient />);
    expect(container.querySelectorAll('[data-accent-edge="false"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-accent-edge="true"]').length).toBeGreaterThan(0);
  });

  it("renders both SignalLine variants: still, and revealing", () => {
    const { container } = render(<GalleryClient />);
    expect(container.querySelectorAll('[data-reveal="false"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-reveal="true"]').length).toBeGreaterThan(0);
  });

  it("renders the twelve background column rules", () => {
    const { container } = render(<GalleryClient />);
    expect(container.querySelectorAll("[data-column]")).toHaveLength(12);
  });

  it("gives every reticle an accessible name", () => {
    render(<GalleryClient />);
    const reticles = screen.getAllByRole("img");
    expect(reticles.length).toBeGreaterThan(0);
    for (const r of reticles) expect(r).toHaveAccessibleName();
  });

  it("includes the narrow-width stress section", () => {
    const { container } = render(<GalleryClient />);
    expect(screen.getByText(/narrow-width stress/i)).toBeInTheDocument();
    expect(container.querySelector("[data-pass-stress-width]")).not.toBeNull();
  });

  it("uses realistic magnitudes", () => {
    const { container } = render(<GalleryClient />);
    expect(screen.getByText("113,400.00")).toBeInTheDocument();
    expect(screen.getByText("9,876,543.21")).toBeInTheDocument();
    expect(container.textContent).toContain(ADDRESS);
    expect(screen.getByText("0x7f3a…D90E")).toBeInTheDocument();
    expect(screen.getAllByTitle(ADDRESS).length).toBeGreaterThan(0);
  });

  it("shows no emoji anywhere", () => {
    const { container } = render(<GalleryClient />);
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});

describe("reduced-motion toggle", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("reports its pressed state", () => {
    render(<GalleryClient />);
    expect(screen.getByRole("button", { name: /reduced motion/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("flips the pressed state when activated", async () => {
    const user = userEvent.setup({ delay: null });
    render(<GalleryClient />);
    const toggle = screen.getByRole("button", { name: /reduced motion/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("sets a document attribute the injected CSS keys off", async () => {
    // A matchMedia override cannot reach the @media rules the browser evaluates,
    // so the toggle works by attribute instead. Asserting the attribute is what
    // the stylesheet actually reads.
    const user = userEvent.setup({ delay: null });
    const { container } = render(<GalleryClient />);
    await user.click(screen.getByRole("button", { name: /reduced motion/i }));
    expect(container.querySelector("[data-pass-reduced-motion]")).toHaveAttribute(
      "data-pass-reduced-motion",
      "true",
    );
  });

  it("injects CSS that actually disables the signal-line animation", () => {
    const css = reducedMotionPreviewCss();
    expect(css).toContain('[data-pass-reduced-motion="true"]');
    expect(css).toContain("animation: none");
    expect(css).toContain(".pass-signal-line");
  });
});
