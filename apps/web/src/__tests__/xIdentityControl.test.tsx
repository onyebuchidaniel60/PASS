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

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
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
  it("renders the handle in a chip, not the raw identity", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(screen.getByText("@turnttfup99")).toBeInTheDocument();
  });

  it("does NOT render the Sign in button when connected", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Sign in with X" })).toBeNull();
  });

  it("gives the chip an accessible name that is not a bare handle", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    // "X account turnttfup99", not "@turnttfup99" read as punctuation.
    expect(chip).toHaveAccessibleName(/X account turnttfup99/);
    expect(chip).toHaveAttribute("aria-haspopup", "menu");
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

  it("renders the chip from the literal flat /me payload", async () => {
    // Regression: the wire shape has no nested `x` object. This fixture is
    // the exact flat payload from the API source; the component must derive
    // the chip from `connections[]` without throwing.
    mockGet.mockResolvedValue(LITERAL_FLAT_ME);
    render(<XIdentityControl />);
    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    expect(screen.getByText("@turnttfup99")).toBeInTheDocument();
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

describe("XIdentityControl — menu", () => {
  it("opens on click and lists the three actions", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    expect(screen.queryByRole("menu")).toBeNull();

    await waitFor(() => chip.click());

    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAccessibleName("X account");
    expect(screen.getByRole("menuitem", { name: "View profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Disconnect X" })).toBeInTheDocument();
  });

  it("links View profile to /u/{handle}, the extension route (D-019.3)", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    await waitFor(() => chip.click());
    const link = await screen.findByRole("menuitem", { name: "View profile" });
    expect(link).toHaveAttribute("href", "/u/turnttfup99");
  });

  it("links Settings to /settings", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    await waitFor(() => chip.click());
    expect(await screen.findByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("reports its expanded state to assistive tech", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    expect(chip).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => chip.click());
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true"),
    );
  });
});

describe("XIdentityControl — disconnect", () => {
  it("posts to the disconnect endpoint", async () => {
    mockGet.mockResolvedValueOnce(CONNECTED).mockResolvedValueOnce(SIGNED_OUT);
    mockPost.mockResolvedValue({ ok: true });

    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    await waitFor(() => chip.click());
    const item = await screen.findByRole("menuitem", { name: "Disconnect X" });
    await waitFor(() => item.click());

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/x/disconnect"),
    );
  });

  it("returns to the signed-out state afterwards", async () => {
    mockGet.mockResolvedValueOnce(CONNECTED).mockResolvedValueOnce(SIGNED_OUT);
    mockPost.mockResolvedValue({ ok: true });

    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    await waitFor(() => chip.click());
    const item = await screen.findByRole("menuitem", { name: "Disconnect X" });
    await waitFor(() => item.click());

    expect(await screen.findByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
  });

  it("re-reads /me rather than flipping local state optimistically", async () => {
    // If the delete partially failed, an optimistic update would show
    // "signed out" while X is still connected. The server is the only authority.
    mockGet.mockResolvedValueOnce(CONNECTED).mockResolvedValueOnce(CONNECTED);
    mockPost.mockResolvedValue({ ok: true });

    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    await waitFor(() => chip.click());
    const item = await screen.findByRole("menuitem", { name: "Disconnect X" });
    await waitFor(() => item.click());

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    // Server still reports connected, so the chip stays.
    expect(screen.queryByRole("button", { name: "Sign in with X" })).toBeNull();
  });

  it("closes the menu even when the disconnect call fails", async () => {
    mockGet.mockResolvedValue(CONNECTED);
    mockPost.mockRejectedValue(new Error("network"));

    render(<XIdentityControl />);
    const chip = await screen.findByRole("button");
    await waitFor(() => chip.click());
    const item = await screen.findByRole("menuitem", { name: /Disconnect/ });
    await waitFor(() => item.click());

    // No permanent stuck-open menu, and no unhandled rejection.
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
