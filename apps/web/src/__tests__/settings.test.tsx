import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsClient, type Me } from "@/app/settings/SettingsClient";
import { Avatar, ConnectionChip } from "@/components/wave3/identity";
import { notifyMeChanged } from "@/lib/me-events";

// SettingsClient reads the browser wallet session (wagmi) to distinguish a
// linked account from a live wallet session (Bug 2b). Disconnected here.
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));

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
const withLoad = (load: () => Promise<Me>) => load;

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

  it("renders one chip per provider, each with its own state (§10.10.1)", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("Hyperliquid");
    // State is in the label, not in colour alone (§9.4).
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("gives a read-only connection no action rather than a disabled one", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("Ethos");
    // Read-only Ethos offers nothing; the other two each offer their own action.
    expect(screen.queryByRole("button", { name: /Ethos/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Connect X" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link Hyperliquid" })).toBeInTheDocument();
  });

  it("keeps a per-connection failure local instead of blanking the screen", async () => {
    const onConnect = vi.fn().mockRejectedValue(new Error("X rejected the handshake"));
    render(
      <SettingsClient
        probe={authed}
        load={withLoad(withMe())}
        onConnect={onConnect}
      />,
    );
    await screen.findByText("Hyperliquid");
    fireEvent.click(screen.getByRole("button", { name: "Connect X" }));
    // The failure is reported on the chip that failed...
    expect(await screen.findByText("X rejected the handshake")).toBeInTheDocument();
    // ...and the rest of the screen survives it.
    expect(screen.getByText("Hyperliquid")).toBeInTheDocument();
    expect(screen.getByText("pass.to/turnttfup99")).toBeInTheDocument();
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

  it("lists trading accounts by address", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    expect(
      await screen.findByText(/0x1234567890abcdef1234567890abcdef12345678/),
    ).toBeInTheDocument();
  });

  // §10.10 + AGENTS.md: no key material is requested or displayed, ever.
  it("contains no field that would accept key material", async () => {
    const { container } = render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("Hyperliquid");
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
    expect(screen.queryByText("X not connected")).toBeNull();
    current = disconnected;
    const { act } = await import("@testing-library/react");
    await act(async () => {
      notifyMeChanged();
    });
    expect(await screen.findByText("X not connected")).toBeInTheDocument();
  });

  // Bug 2b: a linked account and a live wallet session are two states.
  it("shows the wallet session inactive while the account stays linked", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText(/0x1234567890abcdef1234567890abcdef12345678/);
    expect(screen.getByText(/session inactive/)).toBeInTheDocument();
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