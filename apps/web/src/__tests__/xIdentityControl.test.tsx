import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { XIdentityControl } from "../components/XIdentityControl";

/**
 * The topbar X identity control.
 *
 * First paint matters most: the signed-out button renders BEFORE /me
 * resolves (it is in the server HTML), so the actions track never shows an
 * empty slot that pops a button in late. Signed-in, the same slot shows the
 * X handle with a Disconnect X menu (D-024).
 */

const { mockGet, mockPost, mockReplace } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockReplace: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => "/settings",
}));

const CONNECTED = {
  userId: "user-1",
  profileSlug: null,
  displayName: "Turntt",
  connections: [
    {
      provider: "x",
      connected: true,
      label: "X connected · @turnttfup99",
      displayOnly: false,
      handle: "turnttfup99",
    },
  ],
};

const SIGNED_OUT = {
  userId: "user-1",
  profileSlug: null,
  displayName: null,
  connections: [
    {
      provider: "x",
      connected: false,
      label: "X not connected",
      displayOnly: false,
      handle: null,
    },
  ],
};

/**
 * The literal flat shape `GET /api/v1/me` returns (see
 * `apps/api/src/routes/auth.ts`). A previous version of this file mocked a
 * nested `{ x: { … } }` object that never existed on the wire; the component
 * read `me.x.connected`, which compiled (unchecked `clientGet<T>` cast) and
 * crashed every signed-in page with `TypeError: Cannot read properties of
 * undefined (reading 'connected')`. This fixture pins the real shape so
 * that class of bug fails here instead of in production.
 */
const LITERAL_FLAT_ME = {
  userId: "user-9",
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
    {
      provider: "hyperliquid",
      connected: false,
      label: "Hyperliquid not linked",
      displayOnly: false,
    },
    {
      provider: "ethos",
      connected: false,
      label: "Ethos reputation not resolved",
      displayOnly: true,
    },
  ],
  tradingAccounts: [],
  demoMode: true,
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockReplace.mockReset();
});

describe("XIdentityControl — signed out", () => {
  it("renders a Sign in with X button", async () => {
    mockGet.mockResolvedValue(SIGNED_OUT);
    render(<XIdentityControl />);
    expect(await screen.findByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
  });

  it("does NOT render a handle chip", async () => {
    mockGet.mockResolvedValue(SIGNED_OUT);
    const { container } = render(<XIdentityControl />);
    await screen.findByRole("button", { name: "Sign in with X" });
    expect(container.querySelector(".pass-x-chip")).toBeNull();
  });

  it("treats a rejected /me as signed out, not as an error", async () => {
    // 401 is the normal state for a visitor. A topbar error banner here would
    // be alarming and wrong.
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    render(<XIdentityControl />);
    expect(await screen.findByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
  });
});

describe("XIdentityControl — connected", () => {
  it("shows @handle in the topbar once /me resolves", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    expect(await screen.findByRole("button", { name: "@turnttfup99" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in with X" })).toBeNull();
  });

  it("treats connected-but-no-handle as signed out", async () => {
    // A connection with nothing to show is not a state a chip can represent.
    mockGet.mockResolvedValue({
      userId: "user-1",
      profileSlug: null,
      displayName: null,
      connections: [
        {
          provider: "x",
          connected: true,
          label: "X connected",
          displayOnly: false,
          handle: null,
        },
      ],
    });
    render(<XIdentityControl />);
    expect(await screen.findByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
  });

  it("renders the handle from the literal flat /me payload when connected", async () => {
    // Regression: the wire shape has no nested `x` object. The component
    // must derive connected state from `connections[]` without throwing.
    mockGet.mockResolvedValue(LITERAL_FLAT_ME);
    render(<XIdentityControl />);
    expect(await screen.findByRole("button", { name: "@turnttfup99" })).toBeInTheDocument();
  });
});

describe("XIdentityControl — loading", () => {
  it("renders the sign-in button while /me is in flight (no empty slot)", async () => {
    // First paint holds the button at its final size and position; the
    // probe only ever upgrades it to the handle, never mounts it late.
    let release: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<XIdentityControl />);
    expect(screen.getByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
    release(CONNECTED);
  });
});

describe("XIdentityControl — handle menu", () => {
  it("opens a Disconnect X menu from the handle", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    fireEvent.click(await screen.findByRole("button", { name: "@turnttfup99" }));
    expect(await screen.findByRole("menuitem", { name: "Disconnect X" })).toBeInTheDocument();
  });
});

// NOTE: the disconnect flow (endpoint, key clearing, re-read) is covered in
// topbarIdentity.test.tsx against the topbar menu.
