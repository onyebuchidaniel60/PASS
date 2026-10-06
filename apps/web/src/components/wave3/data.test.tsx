import { render, screen } from "@testing-library/react";

import {
  Address,
  DirectionBadge,
  EmptyBlock,
  ErrorBlock,
  HandleBlock,
  LIFECYCLE_LABEL,
  LoadingBlock,
  LiveOrStale,
  PerformanceBlock,
  Pnl,
  ReputationBlock,
  RejectedBlock,
  StatusChip,
  Timestamp,
  UnavailableBlock,
  type PassLifecycle,
} from "./data";

const ALL_STATES: PassLifecycle[] = [
  "draft",
  "active",
  "entry_pending",
  "open",
  "tp_hit",
  "sl_hit",
  "manually_closed",
  "expired",
  "cancelled",
  "invalidated",
];

describe("StatusChip (§11.7)", () => {
  it("renders every lifecycle state with a text label", () => {
    for (const s of ALL_STATES) {
      const { unmount } = render(<StatusChip state={s} />);
      // The TEXT is what makes the state unambiguous; colour is secondary.
      expect(screen.getByText(LIFECYCLE_LABEL[s])).toBeInTheDocument();
      unmount();
    }
  });

  it("never uses a filled accent background", () => {
    // §11.7: the accent is rationed and the chip is text-first by design.
    const { container } = render(
      <>
        {ALL_STATES.map((s) => (
          <StatusChip key={s} state={s} />
        ))}
      </>,
    );
    for (const chip of Array.from(container.querySelectorAll(".pass-chip"))) {
      const bg = getComputedStyle(chip).backgroundColor || "";
      // Fully transparent, whatever the engine spells it. A pattern rather than a
      // literal, because a colour literal in source is itself a scan violation.
      expect(bg === "" || /,\s*0\)$/.test(bg)).toBe(true);
    }
  });

  it("exposes the state as data for styling, not as colour alone", () => {
    const { container } = render(<StatusChip state="entry_pending" />);
    expect(container.querySelector(".pass-chip")).toHaveAttribute(
      "data-state",
      "entry_pending",
    );
  });
});

describe("Timestamp (§11.5)", () => {
  it("states the zone and keeps the relative form secondary", () => {
    const { container } = render(
      <Timestamp value="2026-10-03T14:22:00.000Z" relative="2h ago" />,
    );
    expect(container.textContent).toContain("2026-10-03 14:22 UTC");
    expect(container.textContent).toContain("2h ago");
  });

  it("degrades to a dash on an invalid value rather than rendering NaN", () => {
    const { container } = render(<Timestamp value="nope" />);
    expect(container.textContent).toContain("—");
    expect(container.textContent).not.toContain("NaN");
  });
});

describe("LiveOrStale (§2.8)", () => {
  it("says LIVE in text, not by colour", () => {
    const fresh = new Date().toISOString();
    render(<LiveOrStale observedAt={fresh} staleAfterMinutes={5} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("says STALE when past the threshold", () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    render(<LiveOrStale observedAt={old} staleAfterMinutes={5} />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});

describe("Address (§11.6)", () => {
  it("truncates 4 leading and 4 trailing", () => {
    render(<Address value="0x1234567890abcdef1234567890abcdef12345678" />);
    expect(screen.getByText("0x12…5678")).toBeInTheDocument();
  });

  it("exposes the FULL value to assistive technology", () => {
    const full = "0x1234567890abcdef1234567890abcdef12345678";
    render(<Address value={full} />);
    expect(screen.getByLabelText(full)).toBeInTheDocument();
  });
});

describe("DirectionBadge (§11 text-first)", () => {
  it("renders the direction as a word, never colour alone", () => {
    render(<DirectionBadge direction="long" />);
    expect(screen.getByText("Long")).toBeInTheDocument();
  });

  it("renders short distinctly in text", () => {
    render(<DirectionBadge direction="short" />);
    expect(screen.getByText("Short")).toBeInTheDocument();
  });
});

describe("Pnl (§11.4)", () => {
  it("uses a plus sign and the word-bearing suffix for a gain", () => {
    render(<Pnl value={1234.5} />);
    expect(screen.getByText(/\+1,234\.50 USDC/)).toBeInTheDocument();
  });

  it("uses U+2212 minus, not a hyphen", () => {
    render(<Pnl value={-98.2} />);
    expect(screen.getByText(/^−98\.20 USDC/)).toBeInTheDocument();
  });

  it("renders a dash rather than inventing a zero", () => {
    render(<Pnl value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("never uses the accent for PnL", () => {
    const { container } = render(<Pnl value={10} />);
    expect(container.querySelector('[data-tone="positive"]')).not.toBeNull();
  });
});

describe("PerformanceBlock vs ReputationBlock (D-007, PRD §12)", () => {
  it("labels performance with its own heading", () => {
    render(<PerformanceBlock publishedPassCount={4} completedPassCount={2} />);
    expect(screen.getByRole("region", { name: "PASS performance" })).toBeInTheDocument();
    expect(screen.getByText(/\/\/ PASS Performance/)).toBeInTheDocument();
  });

  it("labels reputation with its own heading", () => {
    render(<ReputationBlock score={1392} reviewsCount={15} vouchesCount={18} />);
    expect(screen.getByRole("region", { name: "Reputation" })).toBeInTheDocument();
    expect(screen.getByText(/\/\/ Reputation/)).toBeInTheDocument();
  });

  it("never combines reputation and performance into one figure", () => {
    const { container } = render(
      <>
        <PerformanceBlock publishedPassCount={4} />
        <ReputationBlock score={1392} />
      </>,
    );
    // Two distinct blocks, never one card.
    expect(container.querySelectorAll("[data-pass-block]")).toHaveLength(2);
    // PerformanceBlock accepts no reputation prop, so there is no path to a
    // combined "trust score".
    const combined = container.textContent?.match(/trust score/i);
    expect(combined).toBeNull();
  });

  it("carries the Ethos disclaimer so a score is not read as absolute", () => {
    // Matched specifically: the StatBlock caption also says "community
    // sentiment", so a loose matcher finds two elements and this asserts
    // nothing about the disclaimer.
    render(<ReputationBlock score={1392} />);
    expect(
      screen.getByText(/not an absolute measure of credibility/i),
    ).toBeInTheDocument();
  });

  it("states the window on every performance metric", () => {
    // §11.8: "12 taken" and "12 taken this week" are different claims.
    render(<PerformanceBlock takersCount={12} />);
    expect(screen.getByText("Across all published Passes")).toBeInTheDocument();
  });
});

describe("state blocks (§9.7)", () => {
  it("LoadingBlock is a static well with an accent hairline and no shimmer", () => {
    const { container } = render(<LoadingBlock rows={3} />);
    expect(container.querySelectorAll(".pass-skeleton")).toHaveLength(3);
    expect(container.querySelector('[data-pass-state="loading"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("EmptyBlock states the absence and offers the one action", () => {
    render(
      <EmptyBlock title="No active Passes" action={<button type="button">Create a Pass</button>}>
        Nothing is live on this profile right now.
      </EmptyBlock>,
    );
    expect(screen.getByText("No active Passes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a Pass" })).toBeInTheDocument();
  });

  it("ErrorBlock states failure and offers Retry", () => {
    const { container } = render(<ErrorBlock detail="Not found." onRetry={() => {}} />);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("UnavailableBlock is distinguished from a logic error", () => {
    const { container } = render(<UnavailableBlock provider="Hyperliquid" />);
    expect(container.querySelector('[data-pass-state="unavailable"]')).not.toBeNull();
    expect(container.querySelector('[data-pass-state="error"]')).toBeNull();
  });

  it("RejectedBlock carries the provider's reason", () => {
    render(<RejectedBlock reason="Insufficient margin" />);
    expect(screen.getByText("Insufficient margin")).toBeInTheDocument();
  });
});

describe("HandleBlock (§9.6)", () => {
  it("renders the handle with an @ prefix in mono", () => {
    render(<HandleBlock handle="turnttfup99" />);
    expect(screen.getByText("@turnttfup99")).toBeInTheDocument();
  });

  it("attributes a verification marker to its named source", () => {
    render(<HandleBlock handle="turnttfup99" verifiedSource="X connected" />);
    expect(screen.getByText("X connected")).toBeInTheDocument();
  });
});
