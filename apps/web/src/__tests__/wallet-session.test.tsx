import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WalletSessionLine } from "@/app/settings/SettingsClient";

/**
 * Bug 2b: "account linked" (PASS server row) and "wallet session active"
 * (this browser's ConnectKit session) are two states rendered as two lines.
 * Only the browser knows the second.
 */

const ADDR = "0x1234567890abcdef1234567890abcdef12345678";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: ADDR, isConnected: true }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));

describe("WalletSessionLine", () => {
  it("reports active when the browser wallet holds the linked address", () => {
    render(<WalletSessionLine accountAddress={ADDR} />);
    expect(screen.getByText(/session active/)).toBeInTheDocument();
  });

  it("reports inactive for any other address, without unclaiming the link", () => {
    render(
      <WalletSessionLine accountAddress="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" />,
    );
    expect(screen.getByText(/session inactive/)).toBeInTheDocument();
  });
});
