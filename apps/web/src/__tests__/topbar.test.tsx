import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RootLayout from "@/app/layout";

/**
 * Topbar (D-023): @handle with a Disconnect X menu when connected,
 * "Sign in with X" when not, and NO wallet element anywhere in the tree.
 * Identity is X-only; the wallet connects lazily at Take time and has no
 * topbar presence.
 */

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
let currentPath = "/";

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: vi.fn(),
  clientPatch: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  WagmiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  createConfig: () => ({}),
  http: () => ({}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => currentPath,
}));

vi.mock("connectkit", () => ({
  ConnectKitProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getDefaultConfig: () => ({}),
  ConnectKitButton: {
    Custom: () => null,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClient: class {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const ME_ON = {
  userId: "u1",
  profileSlug: null,
  displayName: null,
  connections: [
    {
      provider: "x",
      connected: true,
      label: "X connected · @turnttfup99",
      displayOnly: false,
      handle: "turnttfup99",
    },
  ],
  tradingAccounts: [],
};

beforeEach(() => {
  currentPath = "/";
  mockGet.mockReset();
});

describe("Topbar — D-023 identity-only", () => {
  it("shows Sign in with X and no wallet element when signed out", async () => {
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    const { container } = render(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );
    expect(await screen.findByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search PASS" })).toBeInTheDocument();
    expect(container.querySelector(".pass-wallet")).toBeNull();
    expect(screen.queryByText(/wallet/i)).toBeNull();
  });

  it("links the topbar logo back into the app, not to marketing", async () => {
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    render(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );
    const primary = within(screen.getByRole("navigation", { name: "Primary" }));
    expect(primary.getByRole("link", { name: "PASS home" })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("marks the active destination with aria-current and the ember state", async () => {
    currentPath = "/discover";
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    render(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );
    const primary = within(screen.getByRole("navigation", { name: "Primary" }));
    const discover = primary.getByRole("link", { name: "Discover" });
    expect(discover).toHaveAttribute("aria-current", "page");
    expect(discover).toHaveAttribute("data-active", "true");
    expect(primary.getByRole("link", { name: "Executions" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders the professional footer with the NEAR tagline", async () => {
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    render(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "/docs",
    );
    expect(footer.getByRole("link", { name: "Developers" })).toHaveAttribute(
      "href",
      "/developers",
    );
    expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/onyebuchidaniel60/PASS",
    );
    expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(footer.getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(footer.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(footer.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact",
    );
    // The primary destinations live in the topbar, not in the footer.
    expect(footer.queryByRole("link", { name: "Discover" })).toBeNull();
    expect(footer.queryByRole("link", { name: "My Passes" })).toBeNull();
    expect(footer.getByText(/powered by NEAR Intents/i)).toBeInTheDocument();
  });

  it("keeps the network badge out of the topbar and the footer lockup inline", async () => {
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    const { container } = render(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );

    // The hero owns the only network indicator. The topbar must not render
    // the Hyperliquid pill on any breakpoint.
    expect(container.querySelector(".pass-topbar .pass-network-badge")).toBeNull();

    // The footer repeats the topbar lockup: mark and wordmark are siblings in
    // one flex row, with the tagline as the only line beneath them.
    const lockup = container.querySelector(
      ".pass-footer-brand .pass-brand-lockup",
    );
    expect(lockup).not.toBeNull();
    expect(lockup?.querySelectorAll("svg")).toHaveLength(2);
    expect(lockup?.querySelector(".pass-stale")).toBeNull();
  });

  it("shows @handle and no wallet element when connected", async () => {
    mockGet.mockResolvedValue(ME_ON);
    const { container } = render(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    // Restored: the actions track shows the X identity, never the wallet.
    expect(await screen.findByRole("button", { name: "@turnttfup99" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with X" })).toBeNull();
    expect(container.querySelector(".pass-wallet")).toBeNull();
    expect(screen.queryByText(/wallet/i)).toBeNull();
  });
});
