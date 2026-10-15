import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient, type Me } from "@/app/settings/SettingsClient";
import { Avatar, ConnectionChip } from "@/components/wave3/identity";
import { notifyMeChanged } from "@/lib/me-events";

// Wallet management lives in Settings (D-023: execution wallet, not
// identity). wagmi/connectkit are mocked per the pattern in
// walletControl.test.tsx — the mocks mirror only what Settings consumes:
// useAccount address/isConnected, useDisconnect, ConnectKitButton.Custom.

interface AccountState {
  address?: `0x${string}`;
  isConnected: boolean;
}

let account: AccountState = { isConnected: false };
const disconnect = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => account,
  useDisconnect: () => ({ disconnect }),
}));

vi.mock("connectkit", () => ({
  ConnectKitButton: Object.assign(
    ({ children }: { children: (p: { show: () => void }) => React.ReactNode }) =>
      children({ show: () => {} }),
    {
      Custom: ({
        children,
      }: {
        children: (p: { show: () => void }) => React.ReactNode;
      }) => children({ show: () => {} }),
    },
  ),
}));

// The default profile save (PATCH /profiles/me) and the Settings X
// disconnect (POST /api/v1/auth/x/disconnect) run through the real client
// module. Mocked here so those flows assert the wire call without network.
const { mockPatch, mockClientPost } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
  mockClientPost: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: vi.fn(),
  clientPost: (...a: unknown[]) => mockClientPost(...a),
  clientPatch: (...a: unknown[]) => mockPatch(...a),
  clientDelete: vi.fn(),
}));

beforeEach(() => {
  disconnect.mockReset();
  account = { isConnected: false };
  mockPatch.mockReset();
  mockClientPost.mockReset();
});

const ME: Me = {
  userId: "u1",
  profileSlug: "turnttfup99",
  displayName: "turnttfup99",
  bio: "BTC swings only.",
  handle: "turnttfup99",
  connections: [
    { provider: "X", connected: true, label: "X", displayOnly: false },
    { provider: "hyperliquid", connected: false, label: "Hyperliquid", displayOnly: false },
    { provider: "ethos", connected: true, label: "Ethos", displayOnly: true },
  ],
  tradingAccounts: [
    {
      id: "t1",
      accountAddress: "0x1234567890abcdef1234567890abcdef12345678",
      agentAddress: null,
      isPrimary: true,
    },
  ],
  demoMode: false,
};

const authed = async () => true;
const unauthed = async () => false;
const withMe = (me: Partial<Me> = {}) => async () => ({ ...ME, ...me });

describe("§10.10 Profile and connections", () => {
  it("states the SPECIFIC reason when unauthorized", async () => {
    render(<SettingsClient probe={unauthed} load={withMe()} />);
    expect(
      await screen.findByText("Your profile belongs to a connected X identity."),
    ).toBeInTheDocument();
  });

  it("signed-out settings is a connect CTA, not user data (D-024)", async () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <SettingsClient probe={unauthed} load={withMe()} onNavigate={onNavigate} />,
    );
    expect(
      await screen.findByText("Your profile belongs to a connected X identity."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with X" }));
    expect(onNavigate).toHaveBeenCalledWith("/api/v1/auth/x/start");
    // No name, no slug, no bio, no Save, no avatar, no inputs.
    expect(screen.queryByText("turnttfup99")).toBeNull();
    expect(screen.queryByText("pass.to/turnttfup99")).toBeNull();
    expect(screen.queryByText("BTC swings only.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("input, textarea")).toBeNull();
  });

  it("renders a busy loading state", () => {
    render(<SettingsClient probe={authed} load={() => new Promise<Me>(() => {})} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("renders the error state with Retry", async () => {
    render(
      <SettingsClient
        probe={authed}
        load={async () => {
          throw new Error("profile service down");
        }}
      />,
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await screen.findByText("profile service down")).toBeInTheDocument();
  });

  it("shows the public profile fields (§10.10.2)", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    expect(await screen.findByText("turnttfup99")).toBeInTheDocument();
    expect(screen.getByText("pass.to/turnttfup99")).toBeInTheDocument();
    expect(screen.getByText("BTC swings only.")).toBeInTheDocument();
  });

  it("offers no Save until editing: the bio text itself opens the form", async () => {
    // Fix session: the always-on Save next to the bio is gone. The bio
    // text is the click target; Save appears only in edit mode.
    render(<SettingsClient probe={authed} load={withMe()} />);
    expect(await screen.findByText("BTC swings only.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit bio" }));
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders chips only for connected accounts (§10.10.1, single-state)", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("X");
    // X is connected: its chip states Connected. Ethos is read-only: Read only.
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    // D-023: no wallet chip on the identity row — the execution wallet is
    // managed in the Wallet section below, not as a connection chip.
    expect(screen.queryByText("Hyperliquid")).toBeNull();
  });

  it("shows Connect X instead of a chip when X is disconnected", async () => {
    const off: Me = {
      ...ME,
      connections: ME.connections.map((c) =>
        c.provider.toLowerCase() === "x"
          ? { ...c, connected: false, label: "X not connected" }
          : c,
      ),
    };
    render(<SettingsClient probe={authed} load={withMe(off)} />);
    expect(await screen.findByRole("button", { name: "Connect X" })).toBeInTheDocument();
    expect(screen.queryByText("X not connected")).toBeNull();
  });

  it("navigates the Connect X CTA to the OAuth entry", async () => {
    const off: Me = {
      ...ME,
      connections: ME.connections.map((c) =>
        c.provider.toLowerCase() === "x"
          ? { ...c, connected: false, label: "X not connected" }
          : c,
      ),
    };
    const onNavigate = vi.fn();
    render(<SettingsClient probe={authed} load={withMe(off)} onNavigate={onNavigate} />);
    fireEvent.click(await screen.findByRole("button", { name: "Connect X" }));
    expect(onNavigate).toHaveBeenCalledWith("/api/v1/auth/x/start");
  });

  it("shows the single connect CTA when X is disconnected (D-023)", async () => {
    const bare: Me = {
      ...ME,
      connections: ME.connections.map((c) => ({ ...c, connected: false })),
      tradingAccounts: [],
    };
    render(<SettingsClient probe={authed} load={withMe(bare)} />);
    expect(
      await screen.findByText("Connect X to activate your profile"),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Connect X" })).toBeInTheDocument();
    // Basics stay — display identity is PASS attribution, not account.
    expect(screen.getByText("turnttfup99")).toBeInTheDocument();
    // No linked row: the Wallet section offers its own connect CTA.
    expect(screen.getByText("No wallet linked.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
  });

  it("edits the display name and bio, then saves", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsClient probe={authed} load={withMe()} onSave={onSave} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit bio" }));

    const name = screen.getByLabelText("Display name");
    fireEvent.change(name, { target: { value: "new name" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "new bio" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ displayName: "new name", bio: "new bio" }),
    );
  });

  it("saves through PATCH /profiles/me when no onSave is injected", async () => {
    // The production path: page.tsx passes no onSave, so the client must
    // persist itself. Regression for the dead Save that sent nothing.
    mockPatch.mockResolvedValue({});
    let current: Me = ME;
    render(<SettingsClient probe={authed} load={async () => current} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit bio" }));
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "fresh bio" } });
    current = { ...ME, bio: "fresh bio" };
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith("/api/v1/profiles/me", {
        displayName: "turnttfup99",
        bio: "fresh bio",
      }),
    );
    // Edit mode exits and the re-read bio shows.
    expect(await screen.findByText("fresh bio")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("keeps edit mode and shows the error when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("down"));
    render(<SettingsClient probe={authed} load={withMe()} onSave={onSave} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit bio" }));
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "lost?" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Could not save the profile.")).toBeInTheDocument();
    // Still editing, text intact — nothing is lost to the failure.
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("focuses the bio field when edit mode opens", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit bio" }));
    const bio = screen.getByLabelText("Bio");
    expect(document.activeElement).toBe(bio);
  });

  it("manages the execution wallet in Settings, never as identity (D-023)", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("X");
    // The linked row renders truncated with management actions…
    expect(screen.getByText("0x12…5678")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
    // …but never as an identity chip, and never with key material.
    expect(screen.queryByText("Hyperliquid")).toBeNull();
    expect(screen.queryByText(/session active/)).toBeNull();
    expect(screen.queryByText(/Trading accounts/)).toBeNull();
  });

  // §10.10 + AGENTS.md: no key material is requested or displayed, ever.
  it("contains no field that would accept key material", async () => {
    const { container } = render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("turnttfup99");
    fireEvent.click(screen.getByRole("button", { name: "Edit bio" }));
    expect(container.querySelector('input[type="password"]')).toBeNull();
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of ["private key", "seed phrase", "mnemonic", "secret key"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  // Bug 2a: a connection change elsewhere (topbar disconnect) must refresh
  // this screen's snapshot, not leave it stale until F5.
  it("re-reads /me when another surface mutates connection state", async () => {
    const disconnected: Me = {
      ...ME,
      connections: ME.connections.map((c) =>
        c.provider.toLowerCase() === "x"
          ? { ...c, connected: false, label: "X not connected" }
          : c,
      ),
    };
    let current: Me = ME;
    render(<SettingsClient probe={authed} load={async () => current} />);
    await screen.findByText("X");
    expect(
      screen.queryByText("Connect an account to activate your profile"),
    ).toBeNull();
    current = disconnected;
    const { act } = await import("@testing-library/react");
    await act(async () => {
      notifyMeChanged();
    });
    // X off: the single CTA panel replaces the chips.
    expect(
      await screen.findByText("Connect X to activate your profile"),
    ).toBeInTheDocument();
    expect(screen.queryByText("X not connected")).toBeNull();
  });

  it("renders the reference-14 hero heading (redesign)", async () => {
    // Redesign: Settings opens with a hero headline, not a bare profile
    // block. Section content (Wallet and below) is untouched.
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("turnttfup99");
    expect(
      screen.getByRole("heading", { name: /your account/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Your public identity and the accounts it is bound to."),
    ).toBeNull();
    // Twice on purpose: the section tab and the section heading.
    expect(screen.getAllByText("Wallet").length).toBe(2);
  });

  it("offers NO Disconnect X on Profile — sign-out lives in the topbar menu (D-024)", async () => {
    // Topbar restoration: Profile states identity; the topbar X menu owns
    // the only sign-out path in the UI.
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("X");
    expect(screen.queryByRole("button", { name: "Disconnect X" })).toBeNull();
    // Identity state still renders here.
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("lays identity out as a header row: avatar beside the identity stack (ref 14)", async () => {
    const { container } = render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("turnttfup99");
    const head = container.querySelector(".pass-profile-head");
    expect(head).not.toBeNull();
    // Avatar and identity are row siblings, not stacked abstractions.
    expect(head?.querySelector(".pass-avatar")).not.toBeNull();
    const identity = head?.querySelector(".pass-profile-identity");
    expect(identity).not.toBeNull();
    expect(identity?.textContent).toMatch(/turnttfup99/);
  });
});

describe("Wallet section — connect / unlink / replace", () => {
  const ADDR_B = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;

  const rowB = {
    id: "t2",
    accountAddress: ADDR_B,
    agentAddress: null,
    isPrimary: true,
  };

  it("renders No wallet linked + Connect when no row exists", async () => {
    const linkAccount = vi.fn();
    render(
      <SettingsClient
        probe={authed}
        load={withMe({ tradingAccounts: [] })}
        linkAccount={linkAccount}
      />,
    );
    expect(await screen.findByText("No wallet linked.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(linkAccount).not.toHaveBeenCalled();
  });

  it("links automatically when the browser wallet connects with no row", async () => {
    let current: Me = { ...ME, tradingAccounts: [] };
    const linkAccount = vi.fn(async (a: string) => {
      current = { ...current, tradingAccounts: [rowB] };
      return { id: "t2", accountAddress: a };
    });
    const { rerender } = render(
      <SettingsClient
        probe={authed}
        load={async () => current}
        linkAccount={linkAccount}
      />,
    );
    expect(await screen.findByText("No wallet linked.")).toBeInTheDocument();
    account = { isConnected: true, address: ADDR_B };
    rerender(
      <SettingsClient
        probe={authed}
        load={async () => current}
        linkAccount={linkAccount}
      />,
    );
    await waitFor(() => expect(linkAccount).toHaveBeenCalledWith(ADDR_B));
    expect(await screen.findByText("0xab…abcd")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
  });

  it("unlink confirms, then returns to No wallet linked", async () => {
    let current: Me = ME;
    const unlinkAccount = vi.fn(async () => {
      current = { ...current, tradingAccounts: [] };
    });
    render(
      <SettingsClient
        probe={authed}
        load={async () => current}
        unlinkAccount={unlinkAccount}
      />,
    );
    expect(await screen.findByText("0x12…5678")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    expect(
      await screen.findByText(/Unlink this wallet\? Taking a Pass will require/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unlink wallet" }));
    await waitFor(() => expect(unlinkAccount).toHaveBeenCalledWith("t1"));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("No wallet linked.")).toBeInTheDocument();
  });

  it("replace prompts and swaps to the newly connected wallet", async () => {
    let current: Me = ME;
    const unlinkAccount = vi.fn(async () => undefined);
    const linkAccount = vi.fn(async (a: string) => {
      current = { ...current, tradingAccounts: [rowB] };
      return { id: "t2", accountAddress: a };
    });
    account = { isConnected: true, address: ADDR_B };
    render(
      <SettingsClient
        probe={authed}
        load={async () => current}
        linkAccount={linkAccount}
        unlinkAccount={unlinkAccount}
      />,
    );
    expect(
      await screen.findByText(/Replace the currently linked wallet\?/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replace wallet" }));
    await waitFor(() => expect(unlinkAccount).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(linkAccount).toHaveBeenCalledWith(ADDR_B));
    expect(await screen.findByText("0xab…abcd")).toBeInTheDocument();
  });

  it("copies the full address, not the truncated one", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SettingsClient probe={authed} load={withMe()} />);
    expect(await screen.findByText("0x12…5678")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("0x1234567890abcdef1234567890abcdef12345678"),
    );
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});

describe("Settings redesign (reference 14)", () => {
  const EXTRA = {
    passes: [
      { id: "p1", status: "active" },
      { id: "p2", status: "cancelled" },
    ],
    executions: [
      {
        id: "e1",
        passId: "p1",
        passVersion: 1,
        providerOrderId: "mock_11111111-2222-3333-4444-555555555555",
        providerStatus: "filled",
        simulated: true,
        status: "filled",
        positionSize: "0.25",
        asset: "BTC",
        direction: "LONG",
        realizedPnl: "642.50",
        createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      },
      {
        id: "e2",
        passId: "p1",
        passVersion: 1,
        providerOrderId: "hl-order-99881",
        providerStatus: "filled",
        simulated: false,
        status: "filled",
        positionSize: "0.5",
        asset: "ETH",
        direction: "SHORT",
        realizedPnl: "-120.25",
        createdAt: new Date(Date.now() - 90 * 60_000).toISOString(),
      },
    ],
    ethos: {
      providerProfileId: "ethos_alexcarbon",
      credibilityScore: 1742,
      reviewsCount: 38,
      vouchesCount: 12,
      humanVerified: true,
      sourceUrl: "https://ethos.network/profile/x/turnttfup99",
      syncedAt: new Date().toISOString(),
    },
    performance: {
      slug: "turnttfup99",
      publishedPasses: 2,
      completedPasses: 1,
      passSuccessMetric: 50,
      successMetricWindow: "all-time",
      averageRMultiple: 1.8,
      totalRealizedPnl: "522.25",
      simulated: true,
    },
  };

  const loadExtra = async () => EXTRA;

  it("renders the settings hero", async () => {
    render(<SettingsClient probe={authed} load={withMe()} loadExtra={loadExtra} />);
    expect(
      await screen.findByRole("heading", { name: /your account/i }),
    ).toBeInTheDocument();
  });

  it("renders the three-counter stat band with real values", async () => {
    render(<SettingsClient probe={authed} load={withMe()} loadExtra={loadExtra} />);
    const band = await screen.findByTestId("settings-stat-band");
    expect(band.textContent).toMatch(/Passes created/);
    expect(band.textContent).toMatch(/Executions/);
    expect(band.textContent).toMatch(/Ethos score/);
    expect(band.textContent).toMatch(/1,742/);
  });

  it("renders the Ethos score from the API in the identity header", async () => {
    render(<SettingsClient probe={authed} load={withMe()} loadExtra={loadExtra} />);
    // The score arrives with the overview payload, after the header paints.
    await screen.findByText("Ethos score 1,742");
    const identity = await screen.findByTestId("settings-identity");
    expect(identity.textContent).toMatch(/1,742/);
  });

  it("carries no wallet address in the identity header (D-023)", async () => {
    const { container } = render(
      <SettingsClient probe={authed} load={withMe()} loadExtra={loadExtra} />,
    );
    await screen.findByTestId("settings-identity");
    const identity = container.querySelector('[data-testid="settings-identity"]');
    expect(identity?.textContent).not.toMatch(/0x[0-9a-fA-F]{4,}/);
  });

  it("renders the realized-PnL panel with a sparkline", async () => {
    const { container } = render(
      <SettingsClient probe={authed} load={withMe()} loadExtra={loadExtra} />,
    );
    const pnl = await screen.findByTestId("settings-pnl");
    expect(pnl.textContent).toMatch(/Realized PnL/);
    expect(pnl.querySelector("svg[aria-label]")).not.toBeNull();
  });

  it("labels no activity row, even legacy-simulated ones", async () => {
    render(<SettingsClient probe={authed} load={withMe()} loadExtra={loadExtra} />);
    await screen.findByTestId("settings-activity");
    expect(screen.queryByText(/SIMULATED/)).toBeNull();
    expect(screen.queryByText(/simulated/i)).toBeNull();
  });

  it("offers section navigation: Identity, Connections, Wallet, Tour", async () => {
    render(<SettingsClient probe={authed} load={withMe()} loadExtra={loadExtra} />);
    await screen.findByTestId("settings-identity");
    for (const label of ["Identity", "Connections", "Wallet", "Tour"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });
});

describe("Avatar primitive", () => {
  it("falls back to initials when there is no image", () => {
    render(<Avatar handle="@turnttfup99" />);
    expect(screen.getByText("TU")).toBeInTheDocument();
  });

  it("degrades to a neutral mark with no handle at all", () => {
    const { container } = render(<Avatar />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});

describe("ConnectionChip primitive", () => {
  it("carries state in text, not colour alone (§9.4)", () => {
    render(<ConnectionChip provider="X" tone="error" label="X" />);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("omits the button entirely when there is no action", () => {
    render(<ConnectionChip provider="ethos" tone="displayOnly" label="Ethos" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});