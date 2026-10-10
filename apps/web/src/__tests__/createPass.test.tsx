import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CreatePassClient,
  validate,
} from "../app/passes/new/CreatePassClient";

/**
 * Create Pass — design/DESIGN.md §10.5, docs/UX_SPEC.md §7.
 *
 * The validation suite is tested as a PURE function first. That is deliberate:
 * §7's five rules are the substance of this screen, and a pure function tests
 * them without a render, without the network, and without the form's state
 * machine in the way.
 */
const { mockGet, mockPost, mockPatch, searchGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  searchGet: vi.fn((_key: string): string | null => null),
}));
vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
  clientPatch: (...a: unknown[]) => mockPatch(...a),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => searchGet(k) }),
}));

const MARKETS = [
  { asset: "BTC", dex: "perp", maxLeverage: 40 },
  { asset: "ETH", dex: "perp", maxLeverage: 25 },
];

function rejected(message: string): Promise<never> {
  const p = Promise.reject(new Error(message));
  p.catch(() => {});
  return p;
}

const BASE = {
  asset: "BTC",
  direction: "long" as const,
  entryType: "limit" as const,
  entry: "113400",
  sl: "111900",
  tp: "116000",
  leverage: 5,
  expiry: "2099-01-01T00:00",
  markets: MARKETS,
};

describe("live validation (UX_SPEC §7)", () => {
  it("accepts a well-formed long plan", () => {
    expect(validate(BASE)).toEqual({});
  });

  it("rejects an unsupported market (§7 supported market)", () => {
    expect(validate({ ...BASE, asset: "DOGE" }).entry).toBe(
      "That market is not supported.",
    );
  });

  it("requires an entry price for a limit entry (§7 price ordering)", () => {
    expect(validate({ ...BASE, entry: "" }).entry).toBe("Enter an entry price.");
  });

  it("requires a stop loss and a take profit", () => {
    const e = validate({ ...BASE, sl: "", tp: "" });
    expect(e.sl).toBe("Enter a stop loss.");
    expect(e.tp).toBe("Enter a take profit.");
  });

  it("enforces TP/SL direction consistency for a long (§7)", () => {
    expect(validate({ ...BASE, sl: "114000" }).sl).toBe(
      "For a long Pass the stop must be below the entry.",
    );
    expect(validate({ ...BASE, tp: "112000" }).tp).toBe(
      "For a long Pass the target must be above the entry.",
    );
  });

  it("enforces TP/SL direction consistency for a short (§7)", () => {
    const short = { ...BASE, direction: "short" as const, sl: "114000", tp: "112000" };
    expect(validate(short)).toEqual({});
    expect(validate({ ...short, sl: "112000" }).sl).toBe(
      "For a short Pass the stop must be above the entry.",
    );
    expect(validate({ ...short, tp: "114000" }).tp).toBe(
      "For a short Pass the target must be below the entry.",
    );
  });

  it("enforces the market's leverage bound (§7 leverage constraints)", () => {
    const e = validate({ ...BASE, asset: "ETH", leverage: 40 });
    expect(e.leverage).toBe("Maximum leverage for ETH is 25x.");
  });

  it("rejects a missing or past expiry (§7 expiry validity)", () => {
    expect(validate({ ...BASE, expiry: "" }).expiry).toBe("Set an expiry.");
    expect(validate({ ...BASE, expiry: "not-a-date" }).expiry).toBe(
      "That is not a valid time.",
    );
    expect(validate({ ...BASE, expiry: "2000-01-01T00:00" }).expiry).toBe(
      "The expiry must be in the future.",
    );
  });
});

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();
  searchGet.mockReset();
  searchGet.mockReturnValue(null);
});

async function renderForm({ authed = true, xConnected = true } = {}) {
  mockGet.mockImplementation((url?: unknown) => {
    const path = String(url ?? "");
    if (path.includes("/api/v1/me")) {
      // The literal flat shape: authoring needs a CONNECTED X identity, not
      // merely a session (Bug 1 — a session surviving an X disconnect must
      // not author). The old `{ user: {} }` mock matched neither shape.
      if (!authed) return rejected("401");
      return Promise.resolve({
        userId: "u1",
        profileSlug: "t",
        displayName: "T",
        connections: [
          xConnected
            ? {
                provider: "x",
                connected: true,
                label: "X connected · @t",
                displayOnly: false,
                handle: "turnttfup99",
              }
            : {
                provider: "x",
                connected: false,
                label: "X not connected",
                displayOnly: false,
                handle: null,
              },
        ],
        tradingAccounts: [],
      });
    }
    return Promise.resolve({ assets: MARKETS });
  });
  let out!: ReturnType<typeof render>;
  await act(async () => {
    out = render(<CreatePassClient />);
  });
  return out;
}

describe("Create Pass states (§10.5)", () => {
  it("shows a loading state before markets resolve", () => {
    let release: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<CreatePassClient />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    release({ assets: MARKETS });
  });

  it("states the SPECIFIC reason when authorization is missing", async () => {
    await renderForm({ authed: false });
    // §9.7 PermissionBlock names the reason rather than a generic "sign in".
    expect(screen.getByText(/connected X identity/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Entry price/)).toBeNull();
  });

  it("withholds the form from a session without an X identity (Bug 1)", async () => {
    // Disconnecting X keeps the PASS session: /me answers 200 with the x
    // entry disconnected. Authoring needs the identity, not the session.
    await renderForm({ authed: true, xConnected: false });
    expect(await screen.findByText(/connected X identity/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Entry price/)).toBeNull();
  });

  it("renders the form when authorized", async () => {
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    expect(screen.getByLabelText(/Asset/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stop loss/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Thesis/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expiry/)).toBeInTheDocument();
  });
});

describe("Create Pass preview and publish (§10.5)", () => {
  it("shows a live preview built from the same primitives as the Pass page", async () => {
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    // The preview exists before anything is typed, so the Trader always sees
    // the object they are making.
    expect(screen.getByLabelText("Pass preview")).toBeInTheDocument();
  });

  it("keeps Publish disabled WITH AN INLINE REASON until valid", async () => {
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    const publish = screen.getByRole("button", { name: /Publish/ });
    expect(publish).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getAllByText(
        "Complete the required fields and clear the messages above.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("surfaces validation as text under the field, not as border colour", async () => {
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    const stop = screen.getByLabelText(/Stop loss/);
    const entry = screen.getByLabelText(/Entry price/);
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    // The entry must exist before the stop can be judged against it: with an
    // empty entry there is nothing to compare, so no direction error is raised.
    // That is correct behaviour, not a gap in validation.
    await user.type(entry, "113400");
    await user.type(stop, "120000");
    // A long Pass with a stop above entry is directionally wrong (§7).
    await waitFor(() =>
      expect(
        screen.getByText("For a long Pass the stop must be below the entry."),
      ).toBeInTheDocument(),
    );
    // The message is wired to the control for assistive technology.
    expect(stop).toHaveAccessibleDescription(
      "For a long Pass the stop must be below the entry.",
    );
  });

  it("announces the aggregate problem in a live region", async () => {
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    expect(screen.getByText(/need attention before this Pass can be published/)).toBeInTheDocument();
  });

  it("has no Taker-size field — a Trader publishes a plan, not a size (D-015)", async () => {
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    expect(screen.queryByLabelText(/position size/i)).toBeNull();
    expect(screen.queryByLabelText(/taker size/i)).toBeNull();
  });
});

describe("Create Pass publish path (create then publish)", () => {
  async function fillValidForm() {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    await user.type(screen.getByLabelText(/Stop loss/), "111900");
    await user.type(screen.getByLabelText(/Take profit/), "116000");
    await user.type(screen.getByLabelText(/Entry price/), "113400");
    await user.type(screen.getByLabelText(/Thesis/), "Range top reclaim.");
    await user.type(screen.getByLabelText(/Expiry/), "2099-01-01T00:00");
    const publish = screen.getByRole("button", { name: /^Publish$/ });
    await waitFor(() => expect(publish).not.toHaveAttribute("aria-disabled", "true"));
    return { user, publish };
  }

  it("POSTs the draft, then publishes it, and only then says Published", async () => {
    mockPost
      .mockResolvedValueOnce({ id: "uuid-1", publicId: "UvvuxpWPZ4", version: 1, status: "draft" })
      .mockResolvedValueOnce({ id: "uuid-1", publicId: "UvvuxpWPZ4", status: "active", version: 1, canonicalPath: "/p/UvvuxpWPZ4" });
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    const { user, publish } = await fillValidForm();
    await user.click(publish);

    // Both POSTs fire in order: draft first, publish second.
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost.mock.calls[0]?.[0]).toBe("/api/v1/passes");
    expect(mockPost.mock.calls[1]?.[0]).toBe("/api/v1/passes/uuid-1/publish");
    // Only now is the public URL shown, with a copy control.
    await waitFor(() => expect(screen.getByText("Published")).toBeInTheDocument());
    expect(screen.getByDisplayValue("/p/UvvuxpWPZ4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Pass" })).toHaveAttribute(
      "href",
      "/p/UvvuxpWPZ4",
    );
  });

  it("on publish failure stays on the form and never says published", async () => {
    mockPost
      .mockResolvedValueOnce({ id: "uuid-1", publicId: "UvvuxpWPZ4", version: 1, status: "draft" })
      .mockRejectedValueOnce(
        Object.assign(new Error("A draft Pass cannot be published."), { code: "PASS_NOT_ACTIVE" }),
      );
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    const { user, publish } = await fillValidForm();
    await user.click(publish);

    await waitFor(() => expect(screen.getByText(/Publish failed/)).toBeInTheDocument());
    // The API code is shown and the draft-kept retry path is named.
    expect(screen.getByText(/PASS_NOT_ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/draft was kept/i)).toBeInTheDocument();
    // Still on the form: no Published heading, no public URL, no navigation.
    expect(screen.queryByText("Published")).toBeNull();
    expect(screen.queryByDisplayValue("/p/UvvuxpWPZ4")).toBeNull();
    expect(screen.getByText("Create a Pass")).toBeInTheDocument();
  });

  it("sends null, not an empty string, for a market entry price", async () => {
    mockPost
      .mockResolvedValueOnce({ id: "uuid-1", publicId: "UvvuxpWPZ4", version: 1, status: "draft" })
      .mockResolvedValueOnce({ id: "uuid-1", publicId: "UvvuxpWPZ4", status: "active", version: 1 });
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    // Market entry: the price field stays empty, which the server forbids as "".
    await user.click(screen.getByRole("button", { name: "Market" }));
    await user.type(screen.getByLabelText(/Stop loss/), "111900");
    await user.type(screen.getByLabelText(/Take profit/), "116000");
    await user.type(screen.getByLabelText(/Thesis/), "Market break.");
    await user.type(screen.getByLabelText(/Expiry/), "2099-01-01T00:00");
    const publish = screen.getByRole("button", { name: /^Publish$/ });
    await waitFor(() => expect(publish).not.toHaveAttribute("aria-disabled", "true"));
    await user.click(publish);

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.entryType).toBe("market");
    expect(body.entryPrice).toBeNull();
  });
});

const EDIT_DETAIL = {
  id: "uuid-9",
  publicId: "UvvuxpWPZ4",
  version: 1,
  status: "active",
  asset: "BTC",
  direction: "long",
  entryType: "limit",
  entryPrice: "113400",
  stopLoss: "111900",
  takeProfit: "116000",
  leverage: "5",
  thesis: "Range top reclaim.",
  expiresAt: "2099-01-01T00:00:00.000Z",
  publishedAt: "2026-10-05T09:00:00.000Z",
};

async function renderEditForm(detail: unknown = EDIT_DETAIL) {
  searchGet.mockImplementation((k: string) => (k === "edit" ? "uuid-9" : null));
  mockGet.mockImplementation((url?: unknown) => {
    const path = String(url ?? "");
    if (path.startsWith("/api/v1/me/passes/")) {
      return detail instanceof Error ? rejected(detail.message) : Promise.resolve(detail);
    }
    if (path.includes("/api/v1/me")) {
      return Promise.resolve({
        userId: "u1",
        profileSlug: "t",
        displayName: "T",
        connections: [
          { provider: "x", connected: true, label: "X connected · @t", displayOnly: false, handle: "t" },
        ],
        tradingAccounts: [],
      });
    }
    return Promise.resolve({ assets: MARKETS });
  });
  let out!: ReturnType<typeof render>;
  await act(async () => {
    out = render(<CreatePassClient />);
  });
  return out;
}

describe("Edit Pass (same form, ?edit={id})", () => {
  it("prefills the form from the author's pass", async () => {
    await renderEditForm();
    await waitFor(() => expect(screen.getByText("Edit Pass")).toBeInTheDocument());
    expect(screen.getByLabelText(/Entry price/)).toHaveValue("113400");
    expect(screen.getByLabelText(/Stop loss/)).toHaveValue("111900");
    expect(screen.getByLabelText(/Thesis/)).toHaveValue("Range top reclaim.");
    expect(screen.getByText(/Version 1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/p/UvvuxpWPZ4" })).toHaveAttribute(
      "href",
      "/p/UvvuxpWPZ4",
    );
  });

  it("PATCHes the id with the current version and shows the new version", async () => {
    mockPatch.mockResolvedValueOnce({ id: "uuid-9", version: 2, status: "active" });
    await renderEditForm();
    await waitFor(() => expect(screen.getByText("Edit Pass")).toBeInTheDocument());
    // Refetch after save reports the bumped version (D-018.5 through the UI).
    mockGet.mockImplementation((url?: unknown) => {
      const path = String(url ?? "");
      if (path.startsWith("/api/v1/me/passes/")) {
        return Promise.resolve({ ...EDIT_DETAIL, version: 2, takeProfit: "117500" });
      }
      if (path.includes("/api/v1/me")) {
        return Promise.resolve({
          userId: "u1",
          connections: [{ provider: "x", connected: true, label: "x", displayOnly: false }],
          tradingAccounts: [],
        });
      }
      return Promise.resolve({ assets: MARKETS });
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    await user.clear(screen.getByLabelText(/Take profit/));
    await user.type(screen.getByLabelText(/Take profit/), "117500");
    const save = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => expect(save).not.toHaveAttribute("aria-disabled", "true"));
    await user.click(save);

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    expect(mockPatch.mock.calls[0]?.[0]).toBe("/api/v1/passes/uuid-9");
    const body = mockPatch.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.version).toBe(1);
    expect(body.takeProfit).toBe("117500");
    await waitFor(() =>
      expect(screen.getByText(/Saved — now version 2/)).toBeInTheDocument(),
    );
  });

  it("hides the form from a non-author and names the refusal", async () => {
    searchGet.mockImplementation((k: string) => (k === "edit" ? "uuid-9" : null));
    mockGet.mockImplementation((url?: unknown) => {
      const path = String(url ?? "");
      if (path.startsWith("/api/v1/me/passes/")) {
        const err = Object.assign(new Error("Only the owning Trader can edit this Pass."), {
          code: "FORBIDDEN",
          status: 403,
        });
        return rejected(err.message);
      }
      if (path.includes("/api/v1/me")) {
        return Promise.resolve({
          userId: "u1",
          connections: [{ provider: "x", connected: true, label: "x", displayOnly: false }],
          tradingAccounts: [],
        });
      }
      return Promise.resolve({ assets: MARKETS });
    });
    await act(async () => {
      render(<CreatePassClient />);
    });
    await waitFor(() =>
      expect(screen.getByText(/This Pass cannot be edited/)).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText(/Entry price/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});