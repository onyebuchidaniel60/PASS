import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient, type Me } from "@/app/settings/SettingsClient";
import { Avatar, ConnectionChip } from "@/components/wave3/identity";
import { notifyMeChanged } from "@/lib/me-events";

// Single-state rule: the hyperliquid section needs the browser session too.
// Mutable so tests cover both halves of the wallet state.
let wallet: { address?: string; isConnected: boolean } = { isConnected: false };

vi.mock("wagmi", () => ({
  useAccount: () => wallet,
  useDisconnect: () => ({ disconnect: vi.fn() }),
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

const ADDR = "0x1234567890abcdef1234567890abcdef12345678";

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

beforeEach(() => {
  wallet = { isConnected: false };
});

describe("§10.10 Profile and connections", () => {
  it("states the SPECIFIC reason when unauthorized", async () => {
    render(<SettingsClient probe={unauthed} load={withMe()} />);
    expect(
      await screen.findByText("Your profile belongs to a connected X identity."),
    ).toBeInTheDocument();
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

  it("offers Save, accent-filled (§10.10.3)", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    const save = await screen.findByRole("button", { name: "Save" });
    expect(save.getAttribute("data-variant")).toBe("primary");
  });

  it("renders chips only for connected accounts (§10.10.1, single-state)", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("X");
    // X is connected: its chip states Connected. Ethos is read-only: Read only.
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    // Hyperliquid's row exists but the browser wallet is off: no chip, no
    // address, no "Not connected" line — the launcher stands in instead.
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(screen.queryByText(ADDR)).toBeNull();
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

  it("shows the single connect CTA when neither account is connected", async () => {
    const bare: Me = {
      ...ME,
      connections: ME.connections.map((c) => ({ ...c, connected: false })),
      tradingAccounts: [],
    };
    render(<SettingsClient probe={authed} load={withMe(bare)} />);
    expect(
      await screen.findByText("Connect an account to activate your profile"),
    ).toBeInTheDocument();
    // Basics stay — display identity is PASS attribution, not account.
    expect(screen.getByText("turnttfup99")).toBeInTheDocument();
  });

  it("edits the display name and bio, then saves", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsClient probe={authed} load={withMe()} onSave={onSave} />);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    const name = screen.getByLabelText("Display name");
    fireEvent.change(name, { target: { value: "new name" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "new bio" } });

    const saves = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saves[saves.length - 1]);
    await vi.waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ displayName: "new name", bio: "new bio" }),
    );
  });

  it("exposes the Hyperliquid identity toggle (§10.10.2), off by default", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    const toggle = await screen.findByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("lists trading accounts by address when the wallet is connected", async () => {
    wallet = { isConnected: true, address: ADDR };
    render(<SettingsClient probe={authed} load={withMe()} />);
    expect(
      await screen.findByText(/0x1234567890abcdef1234567890abcdef12345678/),
    ).toBeInTheDocument();
  });

  // §10.10 + AGENTS.md: no key material is requested or displayed, ever.
  it("contains no field that would accept key material", async () => {
    const { container } = render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("turnttfup99");
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
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
    // X off + wallet off in the mock: the single CTA panel replaces the chips.
    expect(
      await screen.findByText("Connect an account to activate your profile"),
    ).toBeInTheDocument();
    expect(screen.queryByText("X not connected")).toBeNull();
  });

  // Bug 2b, single-state rule: a linked row with no live browser session
  // hides the address and shows the launcher instead. No "linked but
  // inactive" line exists anywhere.
  it("hides the address while the wallet session is off", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByRole("button", { name: "Connect wallet" });
    expect(screen.queryByText(ADDR)).toBeNull();
    expect(screen.queryByText(/session inactive/)).toBeNull();
    expect(screen.queryByText(/session active/)).toBeNull();
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