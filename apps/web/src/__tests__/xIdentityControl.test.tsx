import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { XIdentityControl } from "../components/XIdentityControl";

/**
 * The topbar X identity control.
 *
 * The state that matters most is `unknown`. Rendering "Sign in with X" while
 * `/me` is still in flight means every single page load flashes a button that
 * then either stays or vanishes, and a user reaching for it is reaching for
 * something that is about to move. So the tests pin that it renders NOTHING
 * while loading, which is the assertion that makes the other three states
 * trustworthy.
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
  it("renders NOTHING when connected (chip removed from the topbar)", async () => {
    // Fix session: the handle chip duplicated identity Settings shows, and
    // its menu pointed at a broken profile URL. The topbar actions track is
    // empty when signed in; sign-out (D-024) lives in Settings now.
    mockGet.mockResolvedValue(CONNECTED);
    const { container } = render(<XIdentityControl />);
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(container).toBeEmptyDOMElement(),
    );
    expect(screen.queryByRole("button")).toBeNull();
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

  it("renders nothing from the literal flat /me payload when connected", async () => {
    // Regression: the wire shape has no nested `x` object. The component
    // must derive connected state from `connections[]` without throwing —
    // and connected renders nothing (chip removed).
    mockGet.mockResolvedValue(LITERAL_FLAT_ME);
    const { container } = render(<XIdentityControl />);
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(container).toBeEmptyDOMElement(),
    );
  });
});

describe("XIdentityControl — loading", () => {
  it("renders NOTHING while /me is in flight", async () => {
    // The regression this whole control is built around: do not flash the
    // signed-out button on every page load.
    let release: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const { container } = render(<XIdentityControl />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).toBeNull();
    release(CONNECTED);
  });
});

describe("XIdentityControl — menu removed", () => {
  it("has no menu, no chip, no dropdown when connected", async () => {
    // Fix session: the whole connected menu is gone with the chip. Sign-out
    // (D-024) is covered in settings.test.tsx against the Settings button.
    mockGet.mockResolvedValue(CONNECTED);
    const { container } = render(<XIdentityControl />);
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalled(),
    );
    await waitFor(() =>
      expect(container).toBeEmptyDOMElement(),
    );
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
});

// NOTE (fix session): the disconnect flow moved to the Settings X section
// with the chip. Its endpoint, re-read and failure semantics are covered in
// settings.test.tsx ("Disconnect X (D-024)").
