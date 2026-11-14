import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DocsPage from "@/app/docs/page";

describe("Web documentation (/docs)", () => {
  it("renders the seven documentation sections and sidebar", () => {
    render(<DocsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "The PASS manual." }),
    ).toBeInTheDocument();
    const nav = screen.getByRole("navigation", {
      name: "Documentation sections",
    });
    for (const label of [
      "Introduction",
      "Getting Started (Traders)",
      "Getting Started (Takers)",
      "Prediction Markets",
      "Agent API",
      "Architecture & Security",
      "FAQ & Troubleshooting",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("covers the Agent API, D-027 and the deposit troubleshooting path", () => {
    render(<DocsPage />);
    expect(
      screen.getByRole("heading", { name: "Let a bot execute your plan." }),
    ).toBeInTheDocument();
    expect(screen.getByText(/D-027 — Wallets are unowned/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Must deposit before performing actions/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/No active prediction markets available/i).length,
    ).toBeGreaterThan(0);
  });
});
