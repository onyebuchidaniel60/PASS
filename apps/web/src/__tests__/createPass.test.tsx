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
const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));
vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
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

describe("Create Pass publish path", () => {
  it("shows the published state with links to the Pass and My Passes", async () => {
    mockPost.mockResolvedValue({ publicId: "UvvuxpWPZ4" });
    await renderForm();
    await waitFor(() => expect(screen.getByText("Create a Pass")).toBeInTheDocument());

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    const stop = screen.getByLabelText(/Stop loss/);
    await user.type(stop, "111900");
    await user.type(screen.getByLabelText(/Take profit/), "116000");
    await user.type(screen.getByLabelText(/Entry price/), "113400");
    await user.type(screen.getByLabelText(/Thesis/), "Range top reclaim.");
    await user.type(screen.getByLabelText(/Expiry/), "2099-01-01T00:00");

    const publish = screen.getByRole("button", { name: /Publish/ });
    await waitFor(() => expect(publish).not.toHaveAttribute("aria-disabled", "true"));
    await user.click(publish);

    await waitFor(() => expect(screen.getByText("Pass published")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "View Pass" })).toHaveAttribute(
      "href",
      "/p/UvvuxpWPZ4",
    );
  });
});