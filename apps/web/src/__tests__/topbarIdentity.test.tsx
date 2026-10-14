import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "@/app/settings/SettingsClient";
import { XIdentityControl } from "../components/XIdentityControl";

/**
 * Topbar X identity restoration (D-023/D-024 session).
 *
 * A prior change removed the connected @handle from the topbar, moved
 * sign-out to Profile, and left the signed-out button mounting late (empty
 * slot in the initial HTML). This file pins the restored shape; every test
 * here FAILS against that regression and passes after the fix.
 */

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
  clientPatch: vi.fn(),
  clientDelete: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false }),
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

const CONNECTED_ME = {
  userId: "u1",
  profileSlug: "turnttfup99",
  displayName: "turnttfup99",
  bio: "BTC swings only.",
  handle: "turnttfup99",
  connections: [
    { provider: "x", connected: true, label: "X connected · @turnttfup99", displayOnly: false, handle: "turnttfup99" },
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
const withMe = (me: Record<string, unknown> = {}) => async () => ({ ...CONNECTED_ME, ...me });

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

describe("topbar identity restoration", () => {
  it("signed-out first-paint HTML contains the Sign in with X button", () => {
    // No /me awaited: this is exactly the server-rendered HTML — the button
    // must be present before hydration and before any session probe.
    const html = renderToStaticMarkup(<XIdentityControl />);
    expect(html).toContain("Sign in with X");
    expect(html).toContain("pass-x");
  });

  it("signed-in topbar slot shows @handle once /me resolves", async () => {
    mockGet.mockResolvedValue(CONNECTED_ME);
    render(<XIdentityControl />);
    expect(await screen.findByRole("button", { name: "@turnttfup99" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with X" })).toBeNull();
  });

  it("Profile no longer renders a Disconnect X control", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("turnttfup99");
    expect(screen.queryByRole("button", { name: "Disconnect X" })).toBeNull();
  });

  it("the topbar handle opens a dropdown; Disconnect X clears the session", async () => {
    mockGet.mockResolvedValue(CONNECTED_ME);
    mockPost.mockResolvedValue({ ok: true });
    render(<XIdentityControl />);
    fireEvent.click(await screen.findByRole("button", { name: "@turnttfup99" }));
    expect(await screen.findByRole("menuitem", { name: "Disconnect X" })).toBeInTheDocument();
    // The session dies with the POST: the re-read the disconnect triggers
    // (same Bug 2a bus as Settings) now 401s instead of returning the user.
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Disconnect X" }));
    await screen.findByRole("button", { name: "Sign in with X" });
    expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/x/disconnect");
    expect(screen.queryByRole("button", { name: "@turnttfup99" })).toBeNull();
  });

  it("every clickable Profile control carries the shared button affordance", async () => {
    render(<SettingsClient probe={authed} load={withMe()} />);
    await screen.findByText("turnttfup99");
    // Open edit mode so Save/Cancel render too.
    fireEvent.click(screen.getByRole("button", { name: "Edit bio" }));
    await screen.findByRole("button", { name: "Save" });
    const clickables = Array.from(document.querySelectorAll("button, a[href]"));
    expect(clickables.length).toBeGreaterThan(0);
    for (const el of clickables) {
      // pass-chip is a token-styled control (bordered, chamfered, hover and
      // selected states), not unstyled text: the section-tab anchors on
      // Settings carry it. The contract is "no unstyled clickables".
      expect(
        el.classList.contains("pass-btn") ||
          el.classList.contains("pass-link-btn") ||
          el.classList.contains("pass-chip"),
        `${el.tagName} "${el.textContent?.slice(0, 40)}" has no button affordance class`,
      ).toBe(true);
    }
    // Borderless ghost buttons read as plain text, not as buttons.
    for (const el of document.querySelectorAll("button.pass-btn")) {
      expect(el.getAttribute("data-variant")).not.toBe("ghost");
    }
  });
});
