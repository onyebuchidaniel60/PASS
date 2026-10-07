import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WalletControl } from "@/components/WalletControl";

/**
 * The topbar wallet slot — DESIGN.md §8.4, §14.5, §14.6.
 *
 * These tests exist because of a shipped bug: the slot was
 *
 *     if (isConnected) return null;
 *
 * so the entire right-hand region of the topbar vanished on connect, and there
 * was no connected state anywhere in the product. The first test here is
 * therefore the load-bearing one — it asserts that the slot renders SOMETHING in
 * every state — and the rest cover the menu.
 *
 * wagmi and connectkit are mocked. There is no wagmi mock anywhere in this
 * repo, so this file establishes the pattern; `Providers.tsx` creates a real
 * wagmi config at module scope, which is exactly the kind of side effect that
 * makes an unmocked import unusable in jsdom.
 */

const disconnect = vi.fn();

interface AccountState {
  address?: `0x${string}`;
  isConnected: boolean;
  isConnecting?: boolean;
  isReconnecting?: boolean;
  chainId?: number;
}

let account: AccountState = { isConnected: false };

vi.mock("wagmi", () => ({
  useAccount: () => account,
  useDisconnect: () => ({ disconnect }),
}));

// ConnectKit is mocked, and the mock mirrors the part of its API the product
// actually uses: `ConnectKitButton.Custom`, whose only consumed render prop is
// `show()`. We render the button; ConnectKit owns wallet discovery and the
// modal. The previous `<ConnectKitButton />` was deliberately abandoned — it
// renders a third-party Tailwind widget in the middle of our own design system.
vi.mock("connectkit", () => ({
  ConnectKitButton: Object.assign(
    ({ children }: { children: (p: { show: () => void }) => React.ReactNode }) =>
      children({ show: () => {} }),
    { Custom: ({ children }: { children: (p: { show: () => void }) => React.ReactNode }) => children({ show: () => {} }) },
  ),
}));

const ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as const;
const EXPECTED_CHAIN = 42161;

beforeEach(() => {
  disconnect.mockReset();
  account = { isConnected: false };
});

describe("WalletControl — disconnected", () => {
  it("renders a connect launcher, not nothing", () => {
    const { container } = render(<WalletControl />);
    expect(container.querySelector(".pass-wallet")?.getAttribute("data-state")).toBe(
      "disconnected",
    );
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
  });

  it("hides the explanatory note by default, so the slot cannot widen the topbar", () => {
    // The note is a three-line paragraph. In the topbar it sized the third grid
    // track to max-content, which is what pushed the control toward the middle.
    const { container } = render(<WalletControl />);
    expect(container.querySelector(".pass-note")).toBeNull();
  });

  it("shows the note when explicitly asked", () => {
    const { container } = render(<WalletControl showNote />);
    expect(container.textContent).toContain("never receives a private key");
  });
});

describe("WalletControl — connecting", () => {
  it("shows a disabled button at the same visual weight, not a spinner", () => {
    account = { isConnected: false, isConnecting: true };
    const { container } = render(<WalletControl />);
    expect(container.querySelector(".pass-wallet")?.getAttribute("data-state")).toBe(
      "connecting",
    );
    // The brief's rule: a disabled button, same visual weight. A bespoke bordered
    // word-chip was the previous treatment and it made the control change weight
    // and colour mid-transition, which reads as a different component.
    const button = screen.getByRole("button", { name: /Connecting/ });
    expect(button).toBeDisabled();
    expect(button.className).toContain("pass-btn");
    expect(button).toHaveAttribute("data-variant", "primary");
  });

  it("keeps the same accent variant as the idle launcher, so nothing jumps", () => {
    const { unmount } = render(<WalletControl />);
    const idle = screen.getByRole("button", { name: "Connect wallet" });
    const idleVariant = idle.getAttribute("data-variant");
    const idleSize = idle.getAttribute("data-size");
    unmount();

    account = { isConnected: false, isConnecting: true };
    const { container } = render(<WalletControl />);
    const busy = screen.getByRole("button", { name: /Connecting/ });
    expect(busy.getAttribute("data-variant")).toBe(idleVariant);
    expect(busy.getAttribute("data-size")).toBe(idleSize);
    expect(container.querySelector(".pass-wallet-connect")).toBeTruthy();
  });

  it("treats a reconnect the same way", () => {
    account = { isConnected: true, address: ADDRESS, isReconnecting: true };
    const { container } = render(<WalletControl />);
    expect(container.querySelector(".pass-wallet")?.getAttribute("data-state")).toBe(
      "connecting",
    );
  });
});

describe("WalletControl — the connect launcher is ours, not ConnectKit's", () => {
  it("renders the design system's own button primitive", () => {
    const { container } = render(<WalletControl />);
    const button = container.querySelector(".pass-btn") as HTMLElement;
    // Before this, the launcher was `<ConnectKitButton />` — a third-party
    // Tailwind widget. Now the only thing ConnectKit contributes is `show()`.
    expect(button).toBeTruthy();
    expect(button.className).toContain("pass-wallet-connect");
    expect(button.textContent).toBe("Connect wallet");
  });

  it("carries the primary variant, so it is the one accent fill in the bar (§2.5)", () => {
    const { container } = render(<WalletControl />);
    const accents = container.querySelectorAll('[data-variant="primary"]');
    expect(accents.length).toBe(1);
  });
});

describe("WalletControl — connected", () => {
  beforeEach(() => {
    account = { isConnected: true, address: ADDRESS, chainId: EXPECTED_CHAIN };
  });

  it("renders the truncated address, which is the bug this replaces", () => {
    const { container } = render(<WalletControl />);
    expect(container.querySelector(".pass-wallet")?.getAttribute("data-state")).toBe(
      "connected",
    );
    expect(screen.getByText("0x12…5678")).toBeInTheDocument();
  });

  it("renders SOMETHING, not null — the reported defect", () => {
    const { container } = render(<WalletControl />);
    // The old implementation returned null here, so the topbar's whole
    // right-hand region disappeared on connect.
    expect(container.querySelector(".pass-wallet")).not.toBeNull();
    expect(container.firstElementChild).not.toBeNull();
  });

  it("labels the address for a screen reader instead of announcing a bare hex string", () => {
    render(<WalletControl />);
    expect(screen.getByText("Wallet address 0x12…5678")).toBeInTheDocument();
  });

  it("sets the address in the data face, because an address is data (§11.6)", () => {
    const { container } = render(<WalletControl />);
    // CSS is not loaded in these tests, so the assertion is on the class that
    // carries the treatment rather than on a computed style.
    expect(container.querySelector(".pass-wallet-address")).not.toBeNull();
  });

  it("keeps the menu closed until the chip is clicked", () => {
    render(<WalletControl />);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: /Wallet address/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens the menu on click and reports expanded state", () => {
    render(<WalletControl />);
    const chip = screen.getByRole("button", { name: /Wallet address/ });
    fireEvent.click(chip);
    expect(screen.getByRole("menu", { name: "Wallet" })).toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-expanded", "true");
  });

  it("offers View profile, pointing at the settings route", () => {
    render(<WalletControl />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet address/ }));
    expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("disconnects from the menu", () => {
    render(<WalletControl />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet address/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("closes the menu again after disconnecting is chosen", () => {
    render(<WalletControl />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet address/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));
    // Leaving a menu open over a slot that has just changed state is how a
    // control ends up pointing at a wallet that is gone.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu on Escape", () => {
    render(<WalletControl />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet address/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu on a click outside it", () => {
    render(
      <div>
        <WalletControl />
        <button type="button">elsewhere</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Wallet address/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    act(() => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("toggles closed on a second click of the chip", () => {
    render(<WalletControl />);
    const chip = screen.getByRole("button", { name: /Wallet address/ });
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("WalletControl — wrong network", () => {
  beforeEach(() => {
    account = { isConnected: true, address: ADDRESS, chainId: 1 };
  });

  it("states the chain mismatch rather than failing silently", () => {
    const { container } = render(<WalletControl />);
    expect(container.querySelector(".pass-wallet")?.getAttribute("data-state")).toBe(
      "wrong-chain",
    );
    fireEvent.click(screen.getByRole("button", { name: /Wallet address/ }));
    expect(screen.getByRole("menu")).toHaveTextContent(/Unsupported network/i);
    // Naming both chains is what makes the notice actionable.
    expect(screen.getByRole("menu")).toHaveTextContent("42161");
    expect(screen.getByRole("menu")).toHaveTextContent("1");
  });

  it("still offers Disconnect, because PASS cannot switch chains for the user", () => {
    render(<WalletControl />);
    fireEvent.click(screen.getByRole("button", { name: /Wallet address/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("WalletControl — robustness", () => {
  it("shows the launcher when connected but the address is somehow absent", () => {
    // `isConnected` true with no address would otherwise render a chip reading
    // "0x…", which is worse than admitting the wallet is not usable.
    account = { isConnected: true, chainId: EXPECTED_CHAIN };
    const { container } = render(<WalletControl />);
    expect(container.querySelector(".pass-wallet")?.getAttribute("data-state")).toBe(
      "disconnected",
    );
  });

  it("does not treat an unknown chainId as a mismatch", async () => {
    // `chainId` is undefined while wagmi is still resolving. Calling that a
    // mismatch would flash a red state on every page load.
    account = { isConnected: true, address: ADDRESS };
    const { container } = render(<WalletControl />);
    await waitFor(() =>
      expect(container.querySelector(".pass-wallet")?.getAttribute("data-state")).toBe(
        "connected",
      ),
    );
  });
});
