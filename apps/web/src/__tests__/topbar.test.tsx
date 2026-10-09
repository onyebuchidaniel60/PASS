import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RootLayout from "@/app/layout";

/**
 * Topbar (D-023): X chip when connected, "Sign in with X" when not, and NO
 * wallet element anywhere in the tree. Identity is X-only; the wallet
 * connects lazily at Take time and has no topbar presence.
 */

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

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
  usePathname: () => "/",
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
    expect(container.querySelector(".pass-wallet")).toBeNull();
    expect(screen.queryByText(/wallet/i)).toBeNull();
  });

  it("shows the X chip and no wallet element when connected", async () => {
    mockGet.mockResolvedValue(ME_ON);
    const { container } = render(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    );
    expect(await screen.findByText("@turnttfup99")).toBeInTheDocument();
    expect(container.querySelector(".pass-wallet")).toBeNull();
    expect(screen.queryByText(/wallet/i)).toBeNull();
  });
});
