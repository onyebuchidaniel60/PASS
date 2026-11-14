import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NetworkBadge } from "@/components/NetworkBadge";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
}));

beforeEach(() => {
  mockGet.mockReset();
});

describe("NetworkBadge", () => {
  it("renders Hyperliquid Mainnet with the mainnet tone and a hidden pulse dot", async () => {
    mockGet.mockResolvedValue({ hyperliquidVenue: "mainnet" });
    const { container } = render(<NetworkBadge />);
    const badge = await screen.findByRole("status", {
      name: "Network: Mainnet",
    });
    expect(badge).toHaveTextContent("Hyperliquid Mainnet");
    expect(badge).toHaveAttribute("data-tone", "mainnet");
    const dot = container.querySelector(".pass-network-badge-dot");
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the testnet tone when the server reports testnet", async () => {
    mockGet.mockResolvedValue({ hyperliquidVenue: "testnet" });
    render(<NetworkBadge />);
    const badge = await screen.findByRole("status", {
      name: "Network: Testnet",
    });
    expect(badge).toHaveTextContent("Hyperliquid Testnet");
    expect(badge).toHaveAttribute("data-tone", "testnet");
  });

  it("degrades to an unknown status without throwing", async () => {
    mockGet.mockRejectedValue(new Error("offline"));
    render(<NetworkBadge />);
    expect(
      await screen.findByRole("status", { name: "Network: Unknown" }),
    ).toHaveTextContent("Network status unknown");
  });
});
