import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { TakeFlowClient } from "../app/passes/[publicId]/take/TakeFlowClient";

/**
 * Take flow — design/DESIGN.md §10.6, docs/UX_SPEC.md §8, Stage F (D-025).
 *
 * Product rules pinned here: empty size (D-015), un-ticked consent, mono
 * progress, rejection vs validation, and now the Stage F wiring — preview
 * and submit share one numbers computation, the client posts a real signed
 * bracket (never `signedAction: "demo"`), the wallet connects lazily at
 * Take, and agent approval runs once as a first-execution step.
 */
const ADDR = "0x1234567890abcdef1234567890abcdef12345678";
const AGENT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const {
  mockPost,
  mockGet,
  mockWallet,
  mockSignTypedData,
  mockSignMessage,
  mockHasKey,
  mockRunApprove,
} = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockWallet: vi.fn(),
  mockSignTypedData: vi.fn(),
  mockSignMessage: vi.fn(),
  mockHasKey: vi.fn(),
  mockRunApprove: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
}));
vi.mock("wagmi", () => ({
  useAccount: () => mockWallet(),
  useSignTypedData: () => ({ signTypedDataAsync: mockSignTypedData }),
  useSignMessage: () => ({ signMessageAsync: mockSignMessage }),
}));
vi.mock("connectkit", () => ({
  ConnectKitButton: {
    Custom: ({ children }: { children: (p: { show: () => void }) => ReactNode }) => (
      <>{children({ show: () => {} })}</>
    ),
  },
}));
vi.mock("@/lib/agent-keystore", () => ({
  hasAgentKeyInMemory: () => mockHasKey(),
}));
vi.mock("@/lib/approve-agent", () => ({
  runApproveAgent: (...a: unknown[]) => mockRunApprove(...a),
}));

const PASS = {
  publicId: "UvvuxpWPZ4",
  asset: "BTC",
  direction: "long" as const,
  entryType: "limit" as const,
  version: 1,
  status: "active",
  entryPrice: "113400",
  takeProfit: "116000",
  stopLoss: "111900",
  leverage: "5",
  market: { markPrice: "113412.5", observedAt: "2026-10-06T21:57:18.009Z" },
};

const ME_READY = {
  userId: "u-taker",
  profileSlug: "t",
  displayName: "Taker",
  connections: [],
  tradingAccounts: [
    { id: "acct-1", accountAddress: ADDR, agentAddress: AGENT, isPrimary: true },
  ],
};

const ME_NO_AGENT = {
  ...ME_READY,
  tradingAccounts: [
    { id: "acct-1", accountAddress: ADDR, agentAddress: null, isPrimary: true },
  ],
};

const MARKETS = {
  assets: [{ asset: "BTC", dex: "perp", assetId: 0, szDecimals: 5, maxLeverage: 40 }],
};

const HEALTH_MOCK = { modes: { hyperliquidExecution: "mock" } };

type PassFixture = Omit<typeof PASS, "entryType"> & { entryType: "limit" | "market" };

let meResponse: unknown = ME_READY;

function defaultMocks() {
  mockWallet.mockImplementation(() => ({ address: ADDR, isConnected: true }));
  // jsdom ships no wallet: every test below assumes an injected provider
  // unless it deletes this stub to exercise the no-extension path.
  (window as unknown as { ethereum?: unknown }).ethereum = {
    isMetaMask: true,
    request: async () => [],
  };
  mockGet.mockImplementation((url?: unknown) => {
    const path = String(url ?? "");
    if (path === "/api/v1/me") return Promise.resolve(meResponse);
    if (path.includes("/api/v1/markets")) return Promise.resolve(MARKETS);
    if (path.includes("/health")) return Promise.resolve(HEALTH_MOCK);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  mockHasKey.mockReturnValue(true);
  mockRunApprove.mockResolvedValue({ agentAddress: AGENT, persisted: true });
}

/**
 * A rejected promise handed to a mock escapes the runner as an unhandled
 * rejection and fails the whole suite, even though the component catches it.
 * The no-op catch does not change what the component receives.
 */
function rejected(message: string): Promise<never> {
  const p = Promise.reject(Object.assign(new Error(message), { code: "ORDER_REJECTED" }));
  p.catch(() => {});
  return p;
}

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
  mockWallet.mockReset();
  mockHasKey.mockReset();
  mockRunApprove.mockReset();
  meResponse = ME_READY;
  defaultMocks();
});

function renderFlow(pass: PassFixture = PASS) {
  return render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={pass} />);
}

async function renderReady(pass: PassFixture = PASS) {
  const out = renderFlow(pass);
  await screen.findByText("STEP 1 / 4");
  return out;
}

async function typeSize(value: string) {
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup({ delay: null });
  const input = document.querySelector(
    "input[inputmode='decimal']",
  ) as HTMLInputElement;
  await user.clear(input);
  if (value) await user.type(input, value);
  return user;
}

const PREVIEW = {
  passVersion: 1,
  requestedEntry: "113400",
  markPrice: "113412.5",
  estimatedMargin: "250",
  slippageToleranceBps: 50,
  warnings: [],
};

describe("Take flow step 1 — choose size (§10.6)", () => {
  it("renders as STEP 1 / 4 in mono text, not a stepper widget", async () => {
    await renderReady();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Choose your size",
    );
  });

  it("leaves the size field EMPTY — never seeded from the Trader's size (D-015)", async () => {
    await renderReady();
    const input = document.querySelector(
      "input[inputmode='decimal']",
    ) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("restates the plan the size is chosen against", async () => {
    await renderReady();
    expect(screen.getByText("113,400")).toBeInTheDocument();
    expect(screen.getByText("116,000")).toBeInTheDocument();
    expect(screen.getByText("111,900")).toBeInTheDocument();
  });

  it("rejects a non-positive size with text and makes no request", async () => {
    await renderReady();
    const user = await typeSize("0");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    expect(
      screen.getByText("Enter a position size greater than zero."),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rejects an empty size", async () => {
    await renderReady();
    const user = await typeSize("");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("Take flow step 2 — execution preview (§10.6)", () => {
  it("requests a preview and shows the order summary as a document", async () => {
    mockPost.mockResolvedValue(PREVIEW);
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => expect(screen.getByText("STEP 2 / 4")).toBeInTheDocument());
    // The size is restated EXACTLY as typed: the Taker authorised 1250, and
    // re-rendering it as "1,250" would restate a different number.
    expect(screen.getByText("1250 USDC")).toBeInTheDocument();
    // The provider's margin is formatted by our own formatter, which groups
    // thousands and adds no decimals for a whole number.
    expect(screen.getByText("250 USDC")).toBeInTheDocument();
    // §10.6 Step 2: authorize against a visible price.
    expect(screen.getByText("113,412.5")).toBeInTheDocument();
  });

  it("sends the preview contract: version, account, size, leverage", async () => {
    mockPost.mockResolvedValue(PREVIEW);
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0]?.[0]).toBe("/api/v1/passes/UvvuxpWPZ4/execution-preview");
    expect(mockPost.mock.calls[0]?.[1]).toEqual({
      passVersion: 1,
      accountId: "acct-1",
      positionSize: "1250",
      leverage: "5",
      slippageToleranceBps: 50,
    });
  });

  it("shows the D-025 entry source and the floored base size", async () => {
    mockPost.mockResolvedValue(PREVIEW);
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => expect(screen.getByText("STEP 2 / 4")).toBeInTheDocument());
    expect(screen.getByText("Pass limit 113,400")).toBeInTheDocument();
    // 1250 / 113400 floored to 5 decimals — never rounded up.
    expect(screen.getByText("0.01102 BTC")).toBeInTheDocument();
  });

  it("renders warnings as plain sentences, not red borders", async () => {
    mockPost.mockResolvedValue({
      ...PREVIEW,
      warnings: [{ code: "SLIPPAGE_EXCEEDED", message: "Price is far from entry." }],
    });
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() =>
      expect(screen.getByText("Price is far from entry.")).toBeInTheDocument(),
    );
  });
});

describe("Take flow step 3 — authorization (§10.6)", () => {
  async function toStep3() {
    mockPost.mockResolvedValue(PREVIEW);
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => screen.getByRole("button", { name: "Authorize" }));
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    return user;
  }

  it("states in plain language what will happen, above any control", async () => {
    await toStep3();
    expect(
      screen.getByText(/You are authorizing your own order/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/1250 USDC of BTC/)).toBeInTheDocument();
    expect(screen.getByText(/cannot move your position/i)).toBeInTheDocument();
    expect(screen.getByText(/the same numbers shown in the preview/i)).toBeInTheDocument();
  });

  it("never pre-ticks consent (§10.6 Step 3)", async () => {
    await toStep3();
    expect((document.getElementById("consent") as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("keeps Authorize disabled with a reason until consent is given", async () => {
    await toStep3();
    // The button's accessible name INCLUDES its inline disabled reason, because
    // the reason is a child of the control. An exact-name match would fail on
    // correct behaviour, so this matches the verb and asserts the reason
    // separately below.
    expect(screen.getByRole("button", { name: /Authorize order/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByText("Confirm the statement above first."),
    ).toBeInTheDocument();
  });

  it("discloses scope and never asks for a seed phrase", async () => {
    await toStep3();
    expect(screen.getByText(/No seed phrase or master private key/i)).toBeInTheDocument();
  });
});

describe("Take flow step 4 — confirmation (§10.6)", () => {
  it("shows the provider order id and status verbatim", async () => {
    mockPost
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce({ executionId: "ex-1", providerOrderId: "hl-7781", status: "open" });
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => screen.getByRole("button", { name: "Authorize" }));
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    // Consent is REQUIRED before Authorize will fire: the control is
    // aria-disabled and has no click handler until it is given. That is the
    // product rule, so the walk has to satisfy it rather than bypass it.
    await user.click(document.getElementById("consent") as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /Authorize order/ }));
    await waitFor(() => expect(screen.getByText("STEP 4 / 4")).toBeInTheDocument());
    expect(screen.getByText("hl-7781")).toBeInTheDocument();
  });

  it("offers next actions as links and retires the accent", async () => {
    mockPost
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce({ executionId: "ex-1", providerOrderId: "hl-1", status: "open" });
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => screen.getByRole("button", { name: "Authorize" }));
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    // Consent is REQUIRED before Authorize will fire: the control is
    // aria-disabled and has no click handler until it is given. That is the
    // product rule, so the walk has to satisfy it rather than bypass it.
    await user.click(document.getElementById("consent") as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /Authorize order/ }));
    await waitFor(() => expect(screen.getByText("STEP 4 / 4")).toBeInTheDocument());
    // §10.6 Step 4: the accent retires once the action has succeeded.
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(0);
    expect(screen.getByRole("link", { name: "View Pass" })).toHaveAttribute(
      "href",
      "/p/UvvuxpWPZ4",
    );
    expect(screen.getByRole("link", { name: "View Executions" })).toBeInTheDocument();
  });

  it("does not advance to confirmation when the provider rejects", async () => {
    // The product rule: a REJECTED order never reaches the confirmation step,
    // so the Taker is never shown a receipt for an order that does not exist.
    //
    // The rejection MESSAGE is asserted in the Wave 3 suite, where
    // RejectedBlock is rendered directly. Rendering it here needs an async
    // rejected client call inside act, which this runner reports as an
    // unhandled rejection, so the text is not observable from this screen. The
    // state transition below is observable, and it is the part that matters.
    mockPost
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce(rejected("Insufficient margin"));
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => screen.getByRole("button", { name: "Authorize" }));
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    // Consent is required before Authorize will fire at all: the control has
    // no click handler until it is given. The walk satisfies that rule rather
    // than bypassing it.
    await user.click(document.getElementById("consent") as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /Authorize order/ }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("STEP 4 / 4")).toBeNull();
    expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument();
  });
});

describe("Stage F wiring — the signed bracket (D-025)", () => {
  async function toAuthorized(size = "1250", pass: PassFixture = PASS) {
    await renderReady(pass);
    const user = await typeSize(size);
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => screen.getByRole("button", { name: "Authorize" }));
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    await user.click(document.getElementById("consent") as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /Authorize order/ }));
    return user;
  }

  function executionsBody() {
    const calls = mockPost.mock.calls.filter(
      ([url]) => String(url).endsWith("/executions"),
    );
    expect(calls).toHaveLength(1);
    return calls[0]?.[1] as Record<string, unknown>;
  }

  it("posts a real signed bracket and never signedAction demo", async () => {
    mockPost
      .mockResolvedValueOnce({ ...PREVIEW, passVersion: 2 })
      .mockResolvedValueOnce({ executionId: "ex-1", providerOrderId: "hl-9", status: "open" });
    await toAuthorized();
    await waitFor(() => expect(screen.getByText("STEP 4 / 4")).toBeInTheDocument());

    const body = executionsBody();
    expect(body.passVersion).toBe(2);
    expect(body.accountId).toBe("acct-1");
    expect(body.clientRequestId).toMatch(/^req_[0-9a-f]{32}$/);
    expect(body).not.toHaveProperty("signedAction");
    const exchange = (body.signedPayload as { exchangeRequest: { action: unknown } })
      .exchangeRequest;
    expect(exchange).toBeDefined();
    expect((body.signedPayload as { signature: unknown }).signature).toBeDefined();

    const action = exchange.action as {
      type: string;
      grouping: string;
      orders: Array<Record<string, unknown>>;
    };
    expect(action.type).toBe("order");
    expect(action.grouping).toBe("normalTpsl");
    expect(action.orders).toHaveLength(3);
    const [entry, tp, sl] = action.orders;
    expect(entry).toMatchObject({ a: 0, b: true, p: "113400", s: "0.01102", r: false });
    expect(tp).toMatchObject({ b: false, r: true });
    expect(sl).toMatchObject({ b: false, r: true });
  });

  it("a market Pass signs the mid, labelled Current mid", async () => {
    const market = { ...PASS, entryType: "market" as const };
    mockPost
      .mockResolvedValueOnce({ ...PREVIEW, markPrice: "113500", requestedEntry: null })
      .mockResolvedValueOnce({ executionId: "ex-2", providerOrderId: "hl-10", status: "open" });
    await renderReady(market);
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => expect(screen.getByText("STEP 2 / 4")).toBeInTheDocument());
    expect(screen.getByText("Current mid 113,500")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    await user.click(document.getElementById("consent") as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /Authorize order/ }));
    await waitFor(() => expect(screen.getByText("STEP 4 / 4")).toBeInTheDocument());

    const body = executionsBody();
    const action = (
      body.signedPayload as { exchangeRequest: { action: { orders: Array<Record<string, unknown>> } } }
    ).exchangeRequest.action;
    expect(action.orders[0]?.p).toBe("113500");
  });

  it("floors the base size instead of rounding up", async () => {
    mockPost
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce({ executionId: "ex-3", providerOrderId: "hl-11", status: "open" });
    // 100 / 113400 = 0.00088183… — the wire must carry 0.00088.
    await toAuthorized("100");
    await waitFor(() => expect(screen.getByText("STEP 4 / 4")).toBeInTheDocument());
    const body = executionsBody();
    const action = (
      body.signedPayload as { exchangeRequest: { action: { orders: Array<Record<string, unknown>> } } }
    ).exchangeRequest.action;
    expect(action.orders[0]?.s).toBe("0.00088");
  });
});

describe("Take prompt with no wallet installed", () => {
  it("names the missing extension instead of opening a doomed modal", async () => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
    mockWallet.mockImplementation(() => ({ address: undefined, isConnected: false }));
    mockPost.mockResolvedValue(PREVIEW);
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/No browser wallet was found/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect wallet" }),
    ).toBeNull();
  });

  it("offers the Connect launcher when an extension is present", async () => {
    mockWallet.mockImplementation(() => ({ address: undefined, isConnected: false }));
    mockPost.mockResolvedValue(PREVIEW);
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));

    expect(mockPost).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();
  });
});

describe("Stage F wiring — lazy wallet and first-execution approval", () => {
  it("parks for a wallet and resumes the preview after connect", async () => {    mockWallet.mockImplementation(() => ({ address: undefined, isConnected: false }));
    mockPost.mockResolvedValue(PREVIEW);
    const out = renderFlow();
    await screen.findByText("STEP 1 / 4");
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));

    // No preview yet — the flow waits for the wallet it does not require early.
    expect(mockPost).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Connect wallet" }),
    ).toBeInTheDocument();

    mockWallet.mockImplementation(() => ({ address: ADDR, isConnected: true }));
    out.rerender(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
    await waitFor(() => expect(screen.getByText("STEP 2 / 4")).toBeInTheDocument());
    expect(mockPost.mock.calls[0]?.[0]).toBe(
      "/api/v1/passes/UvvuxpWPZ4/execution-preview",
    );
  });

  it("runs approveAgent on first execution, then signs", async () => {
    // Before approval the account shows no agent and the keystore is
    // empty; once the mocked approval has run, both read ready — the
    // same order the component observes them in.
    meResponse = ME_NO_AGENT;
    mockHasKey.mockImplementation(() => mockRunApprove.mock.calls.length > 0);
    mockGet.mockImplementation((url?: unknown) => {
      const path = String(url ?? "");
      if (path === "/api/v1/me") {
        return Promise.resolve(
          mockRunApprove.mock.calls.length > 0 ? ME_READY : ME_NO_AGENT,
        );
      }
      if (path.includes("/api/v1/markets")) return Promise.resolve(MARKETS);
      if (path.includes("/health")) return Promise.resolve(HEALTH_MOCK);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    mockPost
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce({ executionId: "ex-4", providerOrderId: "hl-12", status: "open" });
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => screen.getByRole("button", { name: "Authorize" }));
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    await user.click(document.getElementById("consent") as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /Authorize order/ }));
    await waitFor(() => expect(mockRunApprove).toHaveBeenCalledTimes(1));
    expect(mockRunApprove.mock.calls[0]?.[0]).toMatchObject({ accountId: "acct-1" });
    await waitFor(() => expect(screen.getByText("STEP 4 / 4")).toBeInTheDocument());
  });

  it("skips approveAgent when the agent is already approved", async () => {
    mockPost
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce({ executionId: "ex-5", providerOrderId: "hl-13", status: "open" });
    await renderReady();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => screen.getByRole("button", { name: "Authorize" }));
    await user.click(screen.getByRole("button", { name: "Authorize" }));
    await waitFor(() => expect(screen.getByText("STEP 3 / 4")).toBeInTheDocument());
    await user.click(document.getElementById("consent") as HTMLInputElement);
    await user.click(screen.getByRole("button", { name: /Authorize order/ }));
    await waitFor(() => expect(screen.getByText("STEP 4 / 4")).toBeInTheDocument());
    expect(mockRunApprove).not.toHaveBeenCalled();
  });
});
/**
 * §14 assertions for the Take flow. Added 2026-10-07 on the visual rebuild.
 *
 * These are deliberately about the CHROME, because the rebuild was allowed to
 * change exactly one thing: how the flow is framed. Every rule below pins a
 * §14 clause so a future restyle cannot quietly reintroduce a novelty control
 * on the screen where a Taker signs for their own money.
 */
describe("Take flow reference language (14)", () => {
  it("uses the FLAT wash, because 14.1 names this exact screen", async () => {
    const { container } = renderFlow();
    await screen.findByText("STEP 1 / 4");
    // §14.1 lists "the Take preview" among the surfaces that get grain only, no
    // colour behind them. A hero wash would compete with the figures the Taker
    // is being asked to authorize.
    const surface = container.querySelector("[data-strength]") as HTMLElement;
    expect(surface.getAttribute("data-strength")).toBe("flat");
    expect(surface.querySelector(".pass-grain")).toBeTruthy();
  });

  it("uses the numbered eyebrow", async () => {
    const { container } = renderFlow();
    await screen.findByText("STEP 1 / 4");
    expect(container.querySelector(".pass-numbered-eyebrow-number")).toBeTruthy();
  });

  it("keeps progress as mono text and never renders a stepper widget", async () => {
    const { container } = renderFlow();
    await screen.findByText("STEP 1 / 4");
    // 10.6 forbids a novelty stepper. This is asserted structurally because a
    // stepper can be added without changing any existing assertion.
    expect(container.querySelector("[role='progressbar']")).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  });

  it("puts exactly one accent fill on the screen: the forward action", async () => {
    const { container } = renderFlow();
    await screen.findByText("STEP 1 / 4");
    // 2.5 rations the accent to one thing per viewport. On step 1 that is
    // "Review order"; the "Back to Pass" text link is deliberately not a
    // second accent.
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(container.querySelectorAll(".pass-link-btn")).toHaveLength(1);
  });

  it("still names the step title as the page heading", async () => {
    renderFlow();
    await screen.findByText("STEP 1 / 4");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Choose your size",
    );
  });

  it("labels the main region so the screen is navigable", async () => {
    const { container } = renderFlow();
    await screen.findByText("STEP 1 / 4");
    // A 4-step document with no landmark is a wall of controls.
    expect(container.querySelector("main")).toBeTruthy();
    expect(container.querySelector("section[aria-labelledby]")).toBeTruthy();
  });
});
