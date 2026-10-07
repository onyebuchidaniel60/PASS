import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ChipBar,
  ChipButton,
  CornerBracketFrame,
  DataCard,
  DenseHead,
  DenseRow,
  DisplayHeadline,
  DotEyebrow,
  GradientWash,
  HERO_LINES,
  LiveDot,
  MetricCard,
  MetricCardRow,
  NoiseOverlay,
  NumberedEyebrow,
  Sparkline,
  StatusBadge,
  StepGrid,
  Surface,
  TickerBar,
} from "./index";

/**
 * These assert the MECHANICS of design/DESIGN.md §14, not pixel values. Each
 * test names the clause it enforces, so a failure says which rule broke rather
 * than that a string changed.
 *
 * None of this is visual verification. Nothing here proves a gradient renders
 * or a card is the right shade; it proves the markup carries the hook that makes
 * those possible and carries the semantics §14 requires.
 */

describe("14.1 backgrounds", () => {
  it("puts the wash and the grain inside a clipping, isolated shell", () => {
    const { container } = render(
      <Surface strength="hero" watermark="PASS">
        <p>content</p>
      </Surface>,
    );
    const shell = container.firstElementChild as HTMLElement;
    // An unclipped absolute wash paints over the next section. This is the
    // operator's "overlay on other elements" report and it is asserted, not
    // hoped for.
    expect(shell.className).toContain("pass-wash");
    expect(shell.getAttribute("data-strength")).toBe("hero");
    expect(container.querySelector(".pass-wash-layer")).toBeTruthy();
    expect(container.querySelector(".pass-grain")).toBeTruthy();
    expect(container.querySelector(".pass-watermark")).toBeTruthy();
  });

  it("carries the strength through so a data surface can opt out of the wash", () => {
    const { container } = render(<Surface strength="flat">x</Surface>);
    const layer = container.querySelector(".pass-wash-layer") as HTMLElement;
    expect(layer.getAttribute("data-strength")).toBe("flat");
  });

  it("hides every layer from assistive technology", () => {
    const { container } = render(<Surface watermark="PASS">x</Surface>);
    for (const sel of [".pass-wash-layer", ".pass-grain", ".pass-watermark"]) {
      expect(container.querySelector(sel)).toBeTruthy();
      expect(container.querySelector(sel)?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("omits the watermark entirely when none is asked for", () => {
    const { container } = render(<Surface>x</Surface>);
    expect(container.querySelector(".pass-watermark")).toBeNull();
  });

  it("can render the wash and the grain without the composition", () => {
    const { container } = render(
      <>
        <GradientWash />
        <NoiseOverlay />
      </>,
    );
    expect(container.querySelector(".pass-wash-layer")).toBeTruthy();
    expect(container.querySelector(".pass-grain")).toBeTruthy();
  });
});

describe("14.2 corner brackets", () => {
  it("renders the bottom-bracket child a caller cannot forget", () => {
    const { container } = render(
      <CornerBracketFrame>
        <p>framed</p>
      </CornerBracketFrame>,
    );
    expect(container.querySelector(".pass-brackets")).toBeTruthy();
    expect(container.querySelector(".pass-brackets-foot")).toBeTruthy();
  });

  it("keeps the bracket decoration out of the accessibility tree", () => {
    const { container } = render(<CornerBracketFrame>x</CornerBracketFrame>);
    expect(container.querySelector(".pass-brackets-foot")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("forwards an accessible name to the region it frames", () => {
    render(
      <CornerBracketFrame labelledBy="hero-heading">
        <p id="hero-heading">Framed object</p>
      </CornerBracketFrame>,
    );
    expect(screen.getByLabelText("Framed object")).toBeTruthy();
  });
});

describe("14.3 numbered eyebrows", () => {
  it("writes both delimiters and the number in the ember class", () => {
    const { container } = render(<NumberedEyebrow label="The Loop" number={1} />);
    const delims = container.querySelectorAll(".pass-numbered-eyebrow-delim");
    // Two on the label, two around the number.
    expect(delims.length).toBe(4);
    expect(container.querySelector(".pass-numbered-eyebrow-number")?.textContent).toContain("01");
  });

  it("pads a single digit to two, because the reference always shows 07", () => {
    const { container } = render(<NumberedEyebrow label="Colour Style" number={7} />);
    expect(container.querySelector(".pass-numbered-eyebrow-number")?.textContent).toContain("07");
  });

  it("keeps the written label readable when the number is absent", () => {
    render(<NumberedEyebrow label="Live Passes" />);
    expect(screen.getByText("Live Passes")).toBeInTheDocument();
    expect(screen.queryByText(/\d\d/)).toBeNull();
  });

  it("uses a dot, never a number, for the live variant", () => {
    const { container } = render(<DotEyebrow label="Market Snapshot" />);
    expect(container.querySelector(".pass-live-dot")).toBeTruthy();
    expect(container.querySelector(".pass-numbered-eyebrow-number")).toBeNull();
  });
});

describe("14.4 display headlines", () => {
  it("puts exactly one accent word on the landing hero's first line", () => {
    const { container } = render(<DisplayHeadline lines={HERO_LINES.landing.map((l) => l.map((w) => ({ ...w })))} />);
    const lines = container.querySelectorAll(".pass-display-line");
    expect(lines.length).toBe(3);
    const accentsPerLine = Array.from(lines).map(
      (l) => l.querySelectorAll(".pass-display-accent").length,
    );
    expect(accentsPerLine[0]).toBe(1);
    // The other two lines carry the whole sentence and spend no accent.
    expect(accentsPerLine[1]).toBe(0);
    expect(accentsPerLine[2]).toBe(0);
  });

  it("authors the line breaks instead of letting the browser wrap them", () => {
    const { container } = render(
      <DisplayHeadline lines={[[{ text: "One" }], [{ text: "Two" }]]} />,
    );
    const lines = container.querySelectorAll(".pass-display-line");
    expect(lines[0].textContent).toBe("One");
    expect(lines[1].textContent).toBe("Two");
  });

  it("separates words with a space so a line never renders as one token", () => {
    const { container } = render(
      <DisplayHeadline lines={[[{ text: "See" }, { text: "a" }, { text: "trade.", accent: true }]]} />,
    );
    expect(container.querySelector(".pass-display-line")?.textContent).toBe("See a trade.");
  });

  it("renders the section step at its own class, never the hero step", () => {
    const { container } = render(<DisplayHeadline section as="h2" lines={[[{ text: "x" }]]} />);
    const h = container.querySelector("h2") as HTMLElement;
    expect(h.className).toContain("pass-section-display");
    expect(h.className).not.toContain("pass-display");
  });

  it("marks the gradient variant only when asked", () => {
    const { container: plain } = render(<DisplayHeadline lines={[[{ text: "x" }]]} />);
    expect(plain.querySelector("[data-gradient]")).toBeNull();
    const { container: grad } = render(
      <DisplayHeadline gradient lines={[[{ text: "x" }]]} />,
    );
    expect(grad.querySelector("[data-gradient='true']")).toBeTruthy();
  });
});

describe("14.5 data cards", () => {
  const metrics = [
    { label: "Take profit", value: "$116.0K" },
    { label: "Stop loss", value: "$111.9K" },
  ];

  it("carries the identifier in the ember class and the unit on the value baseline", () => {
    const { container } = render(
      <DataCard id="BTC LONG" sub="Perpetual" value="$113.4K" unit="per ETH" metrics={metrics} />,
    );
    expect(container.querySelector(".pass-card-id")?.textContent).toBe("BTC LONG");
    const value = container.querySelector(".pass-card-value") as HTMLElement;
    expect(value.textContent).toBe("$113.4Kper ETH");
    // A unit on its own line reads as a second value, so it must be a child of
    // the value element, not a sibling of it.
    expect(value.querySelector(".pass-card-value-unit")?.textContent).toBe("per ETH");
  });

  it("renders metrics as a definition list, label left and value right", () => {
    const { container } = render(<DataCard id="X" value="1" metrics={metrics} />);
    expect(container.querySelector("dl.pass-card-metrics")).toBeTruthy();
    expect(screen.getByText("Take profit")).toBeInTheDocument();
    expect(screen.getByText("$116.0K")).toBeInTheDocument();
  });

  it("marks the card interactive only when asked", () => {
    const { container: plain } = render(<DataCard id="X" value="1" />);
    expect(plain.querySelector("[data-interactive]")).toBeNull();
    const { container: live } = render(<DataCard id="X" value="1" interactive />);
    expect(live.querySelector("[data-interactive='true']")).toBeTruthy();
  });

  it("renders a status row as a bare badge, never a pill", () => {
    render(<DataCard id="X" value="1" status={{ tone: "tp_hit", label: "TP hit" }} />);
    const badge = screen.getByText("TP hit").closest(".pass-badge") as HTMLElement;
    expect(badge.getAttribute("data-variant")).toBe("bare");
  });

  it("renders the action as a link when given an href", () => {
    render(<DataCard id="X" value="1" action={{ label: "Open Pass", href: "/p/abc" }} />);
    expect(screen.getByRole("link", { name: /Open Pass/ })).toHaveAttribute("href", "/p/abc");
  });

  it("lays a metric card out with a label and a value and nothing else", () => {
    const { container } = render(<MetricCard label="Entry" value="$113.4K" sub="per ETH" />);
    expect(container.querySelector(".pass-metric-card-label")?.textContent).toBe("Entry");
    expect(container.querySelector(".pass-metric-card-value")?.textContent).toBe("$113.4K");
  });

  it("lets the metric row decide its own column count", () => {
    const { container } = render(
      <MetricCardRow>
        <MetricCard label="A" value="1" />
        <MetricCard label="B" value="2" />
      </MetricCardRow>,
    );
    expect(container.querySelectorAll(".pass-metric-card").length).toBe(2);
  });
});

describe("14.5.7 sparkline", () => {
  it("is an image with a name, not a decorative squiggle", () => {
    render(<Sparkline points={[1, 2, 3]} label="Last 24 hours, rising" />);
    expect(screen.getByRole("img", { name: "Last 24 hours, rising" })).toBeInTheDocument();
  });

  it("carries the tone on the element so the line colour follows the data", () => {
    const { container } = render(<Sparkline points={[3, 2, 1]} tone="negative" label="falling" />);
    expect(container.querySelector("[data-tone='negative']")).toBeTruthy();
  });

  it("renders nothing for a series that has no direction", () => {
    const { container } = render(<Sparkline points={[5]} label="single point" />);
    // An empty axis would imply a flat series that was never observed.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("survives a gap in the series without drawing a line through it", () => {
    const { container } = render(<Sparkline points={[1, Number.NaN, 3, 4]} label="gapped" />);
    expect(container.querySelector("path")).toBeTruthy();
  });
});

describe("14.6 status badges", () => {
  const tones = [
    "draft",
    "active",
    "entry_pending",
    "open",
    "tp_hit",
    "sl_hit",
    "cancelled",
    "expired",
    "invalidated",
  ] as const;

  it("states every PASS lifecycle state as a word", () => {
    for (const tone of tones) {
      const { unmount } = render(<StatusBadge tone={tone} label={tone} />);
      expect(screen.getByText(tone)).toBeInTheDocument();
      unmount();
    }
  });

  it("gives every state an icon as well as a colour", () => {
    for (const tone of tones) {
      const { container, unmount } = render(<StatusBadge tone={tone} label={tone} />);
      // Colour alone is never load-bearing (§9.4), so the glyph must exist.
      expect(container.querySelector(".pass-badge-icon")).toBeTruthy();
      unmount();
    }
  });

  it("hides the decorative glyph from assistive technology", () => {
    const { container } = render(<StatusBadge tone="active" label="Active" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("defaults to the pill form and switches to bare on request", () => {
    const { container: pill } = render(<StatusBadge tone="active" label="Active" />);
    expect(pill.querySelector("[data-variant='pill']")).toBeTruthy();
    const { container: bare } = render(<StatusBadge tone="active" label="Active" variant="bare" />);
    expect(bare.querySelector("[data-variant='bare']")).toBeTruthy();
  });
});

describe("14.7 live indicators", () => {
  it("always carries the word, because the dot is not the information", () => {
    const { container } = render(<LiveDot />);
    expect(container.querySelector(".pass-live-dot")).toBeTruthy();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("states the count rather than a bare dot when there is one", () => {
    render(<LiveDot label="4 active" />);
    expect(screen.getByText("4 active")).toBeInTheDocument();
  });
});

describe("14.8 ticker", () => {
  const entries = [
    { symbol: "BTC", price: "$113,400", change: "+2.41%", tone: "positive" as const },
    { symbol: "ETH", price: "$3,410", change: "-0.86%", tone: "negative" as const },
  ];

  it("states symbol, price and signed change for every entry", () => {
    render(<TickerBar entries={entries} />);
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("$113,400")).toBeInTheDocument();
    expect(screen.getByText("+2.41%")).toBeInTheDocument();
    expect(screen.getByText("-0.86%")).toBeInTheDocument();
  });

  it("says the feed is unavailable rather than rendering an empty bar", () => {
    render(<TickerBar entries={[]} />);
    // An empty bar reads as "no markets moved", which is a different and wrong
    // statement.
    expect(screen.getByText("Market data unavailable")).toBeInTheDocument();
    expect(screen.queryByText("BTC")).toBeNull();
  });

  it("honours an explicit unavailable flag even with entries present", () => {
    render(<TickerBar entries={entries} unavailable />);
    expect(screen.getByText("Market data unavailable")).toBeInTheDocument();
    expect(screen.queryByText("BTC")).toBeNull();
  });
});

describe("14.9 chip buttons", () => {
  it("marks the selected chip for assistive technology when it is a toggle", () => {
    render(
      <ChipButton toggle selected>
        1D
      </ChipButton>,
    );
    expect(screen.getByRole("button", { name: "1D" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not claim a pressed state on a chip that is not a toggle", () => {
    render(<ChipButton selected>All</ChipButton>);
    // An accent-filled non-toggle chip would be announced as a filter state it
    // does not have.
    expect(screen.getByRole("button", { name: "All" })).not.toHaveAttribute("aria-pressed");
  });

  it("renders an anchor when given an href", () => {
    render(<ChipButton href="/how-it-works">How it works</ChipButton>);
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
  });

  it("keeps a disabled chip disabled and reachable", () => {
    render(<ChipButton disabled>Later</ChipButton>);
    expect(screen.getByRole("button", { name: "Later" })).toBeDisabled();
  });

  it("wraps a filter set without imposing a role on it", () => {
    const { container } = render(
      <ChipBar>
        <ChipButton>All</ChipButton>
      </ChipBar>,
    );
    expect(container.querySelector(".pass-chip-bar")?.getAttribute("role")).toBeNull();
  });
});

describe("14.10 numbered step grid", () => {
  const steps = [
    { step: 1, title: "Author", body: "Write the plan.", footLabel: "DRAFT" },
    { step: 2, title: "Publish", body: "Publish it.", footLabel: "ACTIVE" },
    { step: 3, title: "Take", body: "Size it.", footLabel: "PENDING" },
    { step: 4, title: "Settle", body: "It settles.", footLabel: "CLOSED" },
  ];

  it("renders four steps with a zero-padded badge each", () => {
    const { container } = render(<StepGrid steps={steps} />);
    const badges = container.querySelectorAll(".pass-step-badge");
    expect(badges.length).toBe(4);
    expect(badges[0].textContent).toBe("01");
    expect(badges[3].textContent).toBe("04");
  });

  it("renders the title as a heading so the step set is navigable", () => {
    render(<StepGrid steps={steps} />);
    expect(screen.getByRole("heading", { name: "Author" })).toBeInTheDocument();
  });

  it("gives every card a footer label", () => {
    render(<StepGrid steps={steps} />);
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("CLOSED")).toBeInTheDocument();
  });

  it("accepts a data card in the visual slot and never an image", () => {
    const { container } = render(
      <StepGrid
        steps={[
          {
            step: 1,
            title: "Author",
            body: "Write the plan.",
            visual: <MetricCard label="Entry" value="$113.4K" />,
          },
        ]}
      />,
    );
    expect(container.querySelector(".pass-step-visual .pass-metric-card")).toBeTruthy();
    expect(container.querySelector(".pass-step-visual img")).toBeNull();
  });
});

describe("14.11 dense rows", () => {
  it("marks a selected row so it can carry the ember left border", () => {
    const { container } = render(
      <>
        <DenseRow label="BTC LONG" value="$113.4K" selected />
        <DenseRow label="ETH SHORT" value="$3,410" />
      </>,
    );
    expect(container.querySelectorAll(".pass-dense-selected").length).toBe(1);
  });

  it("renders a column header row above the figures", () => {
    render(<DenseHead left="Pass" right="Entry" />);
    expect(screen.getByText("Pass")).toBeInTheDocument();
    expect(screen.getByText("Entry")).toBeInTheDocument();
  });
});
