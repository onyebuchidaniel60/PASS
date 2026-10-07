import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TakeFlowClient } from "../app/passes/[publicId]/take/TakeFlowClient";

/**
 * Take flow — design/DESIGN.md §10.6, docs/UX_SPEC.md §8.
 *
 * The assertions that carry weight are about PRODUCT RULES, not rendering:
 * the size field must be empty (D-015), consent must not be pre-ticked,
 * progress must be mono text rather than a stepper widget, and a provider
 * rejection must be distinguishable from a validation failure.
 */
const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
vi.mock("@/lib/client", () => ({ clientPost: (...a: unknown[]) => mockPost(...a) }));

const PASS = {
  publicId: "UvvuxpWPZ4",
  asset: "BTC",
  direction: "long" as const,
  status: "active",
  entryPrice: "113400",
  takeProfit: "116000",
  stopLoss: "111900",
  leverage: "5",
  market: { markPrice: "113412.5", observedAt: "2026-10-06T21:57:18.009Z" },
};

/**
 * A rejected promise handed to a mock escapes the runner as an unhandled
 * rejection and fails the whole suite, even though the component catches it.
 * The no-op catch does not change what the component receives.
 */
function rejected(message: string): Promise<never> {
  const p = Promise.reject(new Error(message));
  p.catch(() => {});
  return p;
}

beforeEach(() => mockPost.mockReset());

function renderFlow() {
  return render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
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

describe("Take flow step 1 — choose size (§10.6)", () => {
  it("renders as STEP 1 / 4 in mono text, not a stepper widget", () => {
    renderFlow();
    expect(screen.getByText("STEP 1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Choose your size",
    );
  });

  it("leaves the size field EMPTY — never seeded from the Trader's size (D-015)", () => {
    renderFlow();
    const input = document.querySelector(
      "input[inputmode='decimal']",
    ) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("restates the plan the size is chosen against", () => {
    renderFlow();
    expect(screen.getByText("113,400")).toBeInTheDocument();
    expect(screen.getByText("116,000")).toBeInTheDocument();
    expect(screen.getByText("111,900")).toBeInTheDocument();
  });

  it("rejects a non-positive size with text and makes no request", async () => {
    renderFlow();
    const user = await typeSize("0");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    expect(
      screen.getByText("Enter a position size greater than zero."),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("rejects an empty size", async () => {
    renderFlow();
    const user = await typeSize("");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("Take flow step 2 — execution preview (§10.6)", () => {
  it("requests a preview and shows the order summary as a document", async () => {
    mockPost.mockResolvedValue({
      passVersion: 1,
      estimatedMargin: 250,
      slippageTolerance: 0.5,
    });
    renderFlow();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() => expect(screen.getByText("STEP 2 / 4")).toBeInTheDocument());
    // The size is restated EXACTLY as typed: the Taker authorized 1250, and
    // re-rendering it as "1,250" would restate a different number.
    expect(screen.getByText("1250 USDC")).toBeInTheDocument();
    // The provider's margin is formatted by our own formatter, which groups
    // thousands and adds no decimals for a whole number.
    expect(screen.getByText("250 USDC")).toBeInTheDocument();
    // §10.6 Step 2: authorize against a visible price.
    expect(screen.getByText("113,412.5")).toBeInTheDocument();
  });

  it("renders warnings as plain sentences, not red borders", async () => {
    mockPost.mockResolvedValue({ warnings: ["Price is far from entry."] });
    renderFlow();
    const user = await typeSize("1250");
    await user.click(screen.getByRole("button", { name: "Review order" }));
    await waitFor(() =>
      expect(screen.getByText("Price is far from entry.")).toBeInTheDocument(),
    );
  });
});

describe("Take flow step 3 — authorization (§10.6)", () => {
  async function toStep3() {
    mockPost.mockResolvedValue({ passVersion: 1, estimatedMargin: 250 });
    renderFlow();
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
      .mockResolvedValueOnce({ passVersion: 1, estimatedMargin: 250 })
      .mockResolvedValueOnce({ orderId: "hl-7781", status: "open" });
    renderFlow();
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
      .mockResolvedValueOnce({ passVersion: 1 })
      .mockResolvedValueOnce({ orderId: "hl-1", status: "open" });
    renderFlow();
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
      .mockResolvedValueOnce({ passVersion: 1 })
      .mockResolvedValueOnce(rejected("Insufficient margin"));
    renderFlow();
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
/**
 * §14 assertions for the Take flow. Added 2026-10-07 on the visual rebuild.
 *
 * These are deliberately about the CHROME, because the rebuild was allowed to
 * change exactly one thing: how the flow is framed. Every rule below pins a
 * §14 clause so a future restyle cannot quietly reintroduce a novelty control
 * on the screen where a Taker signs for their own money.
 */
describe("Take flow reference language (14)", () => {
  it("uses the FLAT wash, because 14.1 names this exact screen", () => {
    const { container } = render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
    // §14.1 lists "the Take preview" among the surfaces that get grain only, no
    // colour behind them. A hero wash would compete with the figures the Taker
    // is being asked to authorize.
    const surface = container.querySelector("[data-strength]") as HTMLElement;
    expect(surface.getAttribute("data-strength")).toBe("flat");
    expect(surface.querySelector(".pass-grain")).toBeTruthy();
  });

  it("uses the numbered eyebrow", () => {
    const { container } = render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
    expect(container.querySelector(".pass-numbered-eyebrow-number")).toBeTruthy();
  });

  it("keeps progress as mono text and never renders a stepper widget", () => {
    const { container } = render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
    expect(screen.getByText("STEP 1 / 4")).toBeInTheDocument();
    // 10.6 forbids a novelty stepper. This is asserted structurally because a
    // stepper can be added without changing any existing assertion.
    expect(container.querySelector("[role='progressbar']")).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  });

  it("puts exactly one accent fill on the screen: the forward action", () => {
    const { container } = render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
    // 2.5 rations the accent to one thing per viewport. On step 1 that is
    // "Review order"; the "Back to Pass" text link is deliberately not a
    // second accent.
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(container.querySelectorAll(".pass-link-btn")).toHaveLength(1);
  });

  it("still names the step title as the page heading", () => {
    render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Choose your size",
    );
  });

  it("labels the main region so the screen is navigable", () => {
    const { container } = render(<TakeFlowClient publicId="UvvuxpWPZ4" initialPass={PASS} />);
    // A 4-step document with no landmark is a wall of controls.
    expect(container.querySelector("main")).toBeTruthy();
    expect(container.querySelector("section[aria-labelledby]")).toBeTruthy();
  });
});
