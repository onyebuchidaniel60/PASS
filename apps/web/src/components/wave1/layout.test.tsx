import { render, screen } from "@testing-library/react";

import {
  ChamferPanel,
  GridField,
  Inline,
  PageShell,
  Panel,
  Rule,
  Section,
  ShellContent,
  Stack,
} from "./layout";

/**
 * Wave 1 layout primitives — design/DESIGN.md §9.1.
 *
 * Per-component contract assertions (FRONTEND_IMPLEMENTATION_PLAN.md §2.4):
 * renders with minimal required props, carries its documented landmark or label,
 * and exposes no raw token values in the DOM. The last one matters because a
 * literal in a component is the failure mode the token scan exists to prevent,
 * and asserting it here catches it at authoring time rather than at check time.
 */
describe("Stack", () => {
  it("renders with the minimal required props", () => {
    render(<Stack>content</Stack>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("maps its gap prop to a spacing token, never a literal", () => {
    const { container } = render(<Stack gap="7">content</Stack>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.gap).toBe("var(--space-7)");
  });

  it("defaults to a token gap rather than a number", () => {
    const { container } = render(<Stack>content</Stack>);
    expect((container.firstElementChild as HTMLElement).style.gap).toBe(
      "var(--space-4)",
    );
  });
});

describe("Inline", () => {
  it("renders with the minimal required props", () => {
    render(<Inline>a</Inline>);
    expect(screen.getByText("a")).toBeInTheDocument();
  });

  it("wraps by default so a chip row cannot force horizontal overflow", () => {
    // DESIGN.md §8.5: no element may exceed the viewport horizontally.
    const { container } = render(<Inline>a</Inline>);
    expect((container.firstElementChild as HTMLElement).style.flexWrap).toBe(
      "wrap",
    );
  });

  it("can opt out of wrapping", () => {
    const { container } = render(
      <Inline wrap={false}>a</Inline>,
    );
    expect((container.firstElementChild as HTMLElement).style.flexWrap).toBe(
      "nowrap",
    );
  });
});

describe("Section", () => {
  it("renders a section landmark only when it has an accessible name", () => {
    // HTML-AAM: `<section>` becomes a `region` only when named. An unnamed
    // section is generic, so a test that asserted `region` without a label was
    // asserting something untrue.
    render(<Section label="The plan">body</Section>);
    expect(screen.getByRole("region", { name: "The plan" })).toBeInTheDocument();
  });

  it("is not a landmark when unnamed, and says so by not pretending to be one", () => {
    render(<Section>body</Section>);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("honours an alternate element", () => {
    render(<Section as="div">body</Section>);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});

describe("Panel", () => {
  it("renders with the minimal required props", () => {
    render(<Panel>body</Panel>);
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("carries no inline style, so it cannot smuggle a raw value", () => {
    const { container } = render(<Panel>body</Panel>);
    expect((container.firstElementChild as HTMLElement).getAttribute("style")).toBeNull();
  });
});

describe("ChamferPanel", () => {
  it("renders with the minimal required props", () => {
    render(<ChamferPanel>key object</ChamferPanel>);
    expect(screen.getByText("key object")).toBeInTheDocument();
  });

  it("defaults the accent edge off so a panel cannot accent itself by omission", () => {
    // DESIGN.md §2.5: the accent marks one thing per viewport.
    const { container } = render(<ChamferPanel>key</ChamferPanel>);
    expect(container.firstElementChild).toHaveAttribute("data-accent-edge", "false");
  });

  it("marks the accent edge on the top edge only when asked", () => {
    const { container } = render(<ChamferPanel accentEdge>key</ChamferPanel>);
    expect(container.firstElementChild).toHaveAttribute("data-accent-edge", "true");
  });

  it("exposes its label as an accessible name rather than hidden text", () => {
    render(
      <ChamferPanel as="section" label="Trade plan">
        key
      </ChamferPanel>,
    );
    expect(screen.getByRole("region", { name: "Trade plan" })).toBeInTheDocument();
  });
});

describe("Rule", () => {
  it("is hidden from assistive technology when it carries no meaning", () => {
    const { container } = render(<Rule />);
    expect(container.querySelector("hr")).toHaveAttribute("aria-hidden", "true");
  });

  it("is exposed when a label is supplied, for a meaningful divider", () => {
    render(<Rule label="End of trading context" />);
    expect(screen.getByRole("separator", { name: "End of trading context" })).toBeInTheDocument();
  });
});

describe("GridField", () => {
  it("renders the twelve column rules the grid defines", () => {
    // DESIGN.md §8.2: 12 columns.
    const { container } = render(<GridField />);
    expect(container.querySelectorAll("[data-column]")).toHaveLength(12);
  });

  it("is hidden from assistive technology: it is structural decoration", () => {
    const { container } = render(<GridField />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("PageShell", () => {
  it("renders exactly one main landmark", () => {
    render(<PageShell>page</PageShell>);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  it("does not reserve bottom-nav space unless a bottom nav is present", () => {
    // DESIGN.md §8.4: reserved space and rendered space share one source, so a
    // page with no bottom nav must not carry its clearance.
    const { container } = render(<PageShell>page</PageShell>);
    expect(container.firstElementChild).toHaveAttribute("data-bottom-nav", "false");
  });

  it("reserves the exported nav height when one is present", () => {
    const { container } = render(<PageShell bottomNav>page</PageShell>);
    expect(container.firstElementChild).toHaveAttribute("data-bottom-nav", "true");
  });
});

describe("ShellContent", () => {
  it("renders with the minimal required props", () => {
    render(<ShellContent>content</ShellContent>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
