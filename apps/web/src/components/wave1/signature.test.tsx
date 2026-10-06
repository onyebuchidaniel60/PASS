import { render, screen } from "@testing-library/react";

import {
  CoordinateGrid,
  CoordinatePair,
  Eyebrow,
  Reticle,
  SectionNumber,
  SignalLine,
} from "./signature";

/**
 * Wave 1 signature devices — design/DESIGN.md §9.2.
 *
 * These carry the rules that are easiest to violate by accident, so they are
 * asserted explicitly:
 *  - §7.3 an icon-only control must have an accessible name;
 *  - §2.5 the accent may mark the eyebrow delimiters and the signal line, and
 *    may not mark the heading itself;
 *  - §11.3 the price levels are equal in weight and carry no good/bad colour, so
 *    CoordinatePair must expose no tone variant;
 *  - §11.2 decimals are the caller's to choose, so the component must not
 *    re-round what it is given;
 *  - §6.4 the signal line reveals once and only on the hero.
 */
describe("Eyebrow", () => {
  it("renders with the minimal required props", () => {
    render(<Eyebrow>the plan</Eyebrow>);
    expect(screen.getByText("the plan")).toBeInTheDocument();
  });

  it("frames the label with the ember delimiters by default", () => {
    // DESIGN.md §3.4: `// SECTION NAME \`
    const { container } = render(<Eyebrow>the plan</Eyebrow>);
    expect(container.querySelector(".pass-eyebrow")).toHaveAttribute(
      "data-delimiter",
      "true",
    );
  });

  it("can omit the delimiters", () => {
    const { container } = render(<Eyebrow delimiter={false}>the plan</Eyebrow>);
    expect(container.querySelector(".pass-eyebrow")).toHaveAttribute(
      "data-delimiter",
      "false",
    );
  });

  it("places a section number at the opposite edge of the same row", () => {
    render(<Eyebrow number={4}>the plan</Eyebrow>);
    expect(screen.getByText("// 04 \\")).toBeInTheDocument();
  });
});

describe("SectionNumber", () => {
  it("zero-pads so a ragged number cannot read as inconsistent", () => {
    render(<SectionNumber value={4} />);
    expect(screen.getByText("// 04 \\")).toBeInTheDocument();
  });

  it("renders a two-digit number unchanged", () => {
    render(<SectionNumber value={12} />);
    expect(screen.getByText("// 12 \\")).toBeInTheDocument();
  });

  it("accepts an already-formatted string", () => {
    render(<SectionNumber value="A" />);
    expect(screen.getByText("// A \\")).toBeInTheDocument();
  });
});

describe("SignalLine", () => {
  it("renders with the minimal required props", () => {
    const { container } = render(<SignalLine />);
    expect(container.querySelector(".pass-signal-line")).toBeInTheDocument();
  });

  it("does not animate by default, so an inner panel cannot animate by omission", () => {
    // DESIGN.md gap G-13: the sweep is a hero device only.
    const { container } = render(<SignalLine />);
    expect(container.querySelector(".pass-signal-line")).toHaveAttribute(
      "data-reveal",
      "false",
    );
  });

  it("reveals once when explicitly asked", () => {
    const { container } = render(<SignalLine reveal />);
    expect(container.querySelector(".pass-signal-line")).toHaveAttribute(
      "data-reveal",
      "true",
    );
  });

  it("hides the rule from assistive technology but keeps a node's name reachable", () => {
    // The wrapper must NOT be aria-hidden, or a reticle node placed on it loses
    // the accessible name §7.3 requires. The decorative part is the rule.
    const { container } = render(<SignalLine />);
    expect(container.querySelector("hr")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".pass-signal-line")).not.toHaveAttribute(
      "aria-hidden",
    );
  });

  it("renders an optional reticle node", () => {
    render(<SignalLine node={<Reticle label="Signal origin" />} />);
    expect(screen.getByRole("img", { name: "Signal origin" })).toBeInTheDocument();
  });
});

describe("Reticle", () => {
  it("carries an accessible name, as §7.3 requires for a glyph", () => {
    render(<Reticle label="Coordinate origin" />);
    expect(screen.getByRole("img", { name: "Coordinate origin" })).toBeInTheDocument();
  });

  it("requires a label in its props, so an unlabelled reticle will not compile", () => {
    // The type signature is the enforcement: `label` is not optional.
    render(<Reticle label="x" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("inherits currentColor rather than hard-coding a colour", () => {
    // DESIGN.md §7.1: icon colour is never hard-coded.
    const { container } = render(<Reticle label="x" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg?.getAttribute("style")).toBeNull();
  });
});

describe("CoordinatePair", () => {
  it("renders a label and a value", () => {
    render(<CoordinatePair label="ENTRY" value="113,400.00" />);
    expect(screen.getByText("ENTRY")).toBeInTheDocument();
    expect(screen.getByText("113,400.00")).toBeInTheDocument();
  });

  it("does not re-round or pad the value it is given", () => {
    // DESIGN.md §11.2: decimals follow the market convention supplied by the
    // API; the client formats what it is given and does not re-round.
    render(<CoordinatePair label="BTC-PERP" value="113400" />);
    expect(screen.getByText("113400")).toBeInTheDocument();
  });

  it("exposes no good/bad tone variant, because §11.3 forbids colouring a level", () => {
    const { container } = render(
      <CoordinatePair label="TP" value="116,000.00" />,
    );
    const el = container.querySelector(".pass-coordinate-pair");
    expect(el?.getAttribute("data-tone")).toBeNull();
    expect(el?.getAttribute("style")).toBeNull();
  });

  it("keeps the full value available when the visible one is truncated", () => {
    // DESIGN.md §11.6
    render(
      <CoordinatePair
        label="ADDRESS"
        value="0x1234…cdef"
        fullValue="0x1234567890abcdef1234567890abcdef12345678"
      />,
    );
    expect(
      screen.getByTitle("0x1234567890abcdef1234567890abcdef12345678"),
    ).toBeInTheDocument();
  });

  it("supports the two documented sizes", () => {
    const { rerender, container } = render(
      <CoordinatePair label="ENTRY" value="1" size="m" />,
    );
    expect(container.querySelector(".pass-coordinate-pair")).toHaveAttribute(
      "data-size",
      "m",
    );
    rerender(<CoordinatePair label="ENTRY" value="1" size="l" />);
    expect(container.querySelector(".pass-coordinate-pair")).toHaveAttribute(
      "data-size",
      "l",
    );
  });
});

describe("CoordinateGrid", () => {
  it("renders its children", () => {
    render(
      <CoordinateGrid>
        <CoordinatePair label="ENTRY" value="113,400.00" />
        <CoordinatePair label="TP" value="116,000.00" />
      </CoordinateGrid>,
    );
    expect(screen.getByText("ENTRY")).toBeInTheDocument();
    expect(screen.getByText("TP")).toBeInTheDocument();
  });
});
