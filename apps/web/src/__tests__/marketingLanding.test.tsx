import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketingLandingView } from "@/app/MarketingLandingView";

/**
 * Public marketing landing page at `/`.
 *
 * The page is a marketing composition, so its job is the conversion path: the
 * hero statement, one primary action into the application, and a footer that
 * reaches the public documents. It must not send a visitor back to `/` when
 * they mean "open the app".
 */
describe("Marketing landing page", () => {
  it("renders the fixed hero statement", () => {
    render(<MarketingLandingView />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "See a trade. Know the trader. Take the trade.",
      }),
    ).toBeInTheDocument();
  });

  it("marks the page so the application chrome can be suppressed", () => {
    const { container } = render(<MarketingLandingView />);
    expect(container.querySelector("[data-marketing-page]")).not.toBeNull();
  });

  it("sends every Launch App action to /app", () => {
    render(<MarketingLandingView />);
    const links = screen.getAllByRole("link", { name: "Launch App" });
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/app");
    }
  });

  it("keeps the marketing brand links on /", () => {
    render(<MarketingLandingView />);
    const links = screen.getAllByRole("link", { name: "PASS home" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/");
    }
  });

  it("renders the PASS mark beside the wordmark with its own gradient id", () => {
    render(<MarketingLandingView />);
    const [header] = screen.getAllByRole("link", { name: "PASS home" });
    const marks = header.querySelectorAll("svg");
    expect(marks).toHaveLength(2);
    const gradient = marks[0].querySelector("radialGradient");
    expect(gradient).toHaveAttribute("id", "pass-marketing-header-mark");
    expect(marks[0].querySelector("rect")).toHaveAttribute(
      "fill",
      "url(#pass-marketing-header-mark)",
    );
  });

  it("carries the required footer links", () => {
    render(<MarketingLandingView />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "/docs",
    );
    expect(within(footer).getByRole("link", { name: /GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/onyebuchidaniel60/PASS",
    );
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("renders the approved problem, solution, process and feature sections", () => {
    render(<MarketingLandingView />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Alpha is social. Execution is not." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "One layer. Zero hand-offs." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Three moves. No detours." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Built like infrastructure. Not a group chat.",
      }),
    ).toBeInTheDocument();
    for (const feature of [
      "Non-Custodial",
      "Social Execution",
      "Agent API",
      "Hyperliquid Execution",
    ]) {
      expect(screen.getByRole("heading", { name: feature })).toBeInTheDocument();
    }
  });
});
