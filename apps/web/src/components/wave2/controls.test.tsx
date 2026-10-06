import { render, screen } from "@testing-library/react";
import { useState } from "react";

import {
  Button,
  Checkbox,
  ExpiryControl,
  Field,
  IconButton,
  LeverageStepper,
  LinkButton,
  NumericInput,
  SegmentedControl,
  Select,
  TextInput,
  Textarea,
  Toggle,
  ValidationMessage,
} from "./controls";

/**
 * Wave 2 — actions and form controls (design/DESIGN.md §9.3, §9.4).
 *
 * The contract this wave's gate names, asserted per component:
 * renders with minimal required props; accessible name on every icon-only
 * control; validation as text plus aria-live; target size present in CSS.
 *
 * Target SIZE and press state are asserted through the stylesheet, not the DOM,
 * because a jsdom box has no layout: getComputedStyle on an unloaded CSS file
 * returns nothing. Those two gate items are therefore covered by reading the
 * stylesheet and are recorded as built-not-visually-verified for the operator.
 */

/** Drives a controlled control so state changes are exercised. */
function Harness({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return <TextInput id="t" value={v} onChange={setV} />;
}

describe("Button (§9.3)", () => {
  it("renders with minimal required props", () => {
    render(<Button>Take Pass</Button>);
    expect(screen.getByRole("button", { name: "Take Pass" })).toBeInTheDocument();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Take Pass</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("renders every documented variant", () => {
    for (const v of ["primary", "secondary", "ghost", "destructive"] as const) {
      const { unmount } = render(<Button variant={v}>Act</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("data-variant", v);
      unmount();
    }
  });

  it("renders every documented size", () => {
    for (const s of ["sm", "md", "lg"] as const) {
      const { unmount } = render(<Button size={s}>Act</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("data-size", s);
      unmount();
    }
  });

  it("announces a disabled reason while staying focusable", () => {
    // DESIGN.md §10.5: Publish is disabled WITH AN INLINE REASON, so the
    // reason must reach assistive technology, not just the eye.
    render(<Button disabledReason="Entry must be below the stop loss.">Publish</Button>);
    const btn = screen.getByRole("button", { name: /Publish/ });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("Entry must be below the stop loss."),
    ).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("does not fire onClick while disabled", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    let fired = 0;
    render(<Button onClick={() => (fired += 1)}>Act</Button>);
    await user.click(screen.getByRole("button"));
    expect(fired).toBe(1);
    render(<Button disabled onClick={() => (fired += 1)}>Act</Button>);
    await user.click(screen.getAllByRole("button")[1]);
    expect(fired).toBe(1);
  });
});

describe("IconButton (§9.3, §7.1)", () => {
  it("carries an accessible name from its label", () => {
    render(
      <IconButton label="Copy Pass link">
        <span aria-hidden="true">C</span>
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Copy Pass link" })).toBeInTheDocument();
  });

  it("hides the decorative glyph from assistive technology", () => {
    const { container } = render(
      <IconButton label="Copy">
        <span aria-hidden="true">C</span>
      </IconButton>,
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("LinkButton (§9.3)", () => {
  it("renders a plain link", () => {
    render(<LinkButton href="/discover">Explore Passes</LinkButton>);
    expect(screen.getByRole("link", { name: "Explore Passes" })).toHaveAttribute(
      "href",
      "/discover",
    );
  });

  it("adds noopener noreferrer on an external link", () => {
    render(
      <LinkButton href="https://x.com" external>
        X
      </LinkButton>,
    );
    const a = screen.getByRole("link");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("SegmentedControl (§9.3)", () => {
  const OPTIONS = [
    { value: "long", label: "Long" },
    { value: "short", label: "Short" },
  ] as const;

  it("exposes a named group with one toggle per option", () => {
    render(<SegmentedControl options={OPTIONS} value="long" onChange={() => {}} label="Direction" />);
    expect(screen.getByRole("group", { name: "Direction" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("marks the selected option with aria-pressed", () => {
    render(<SegmentedControl options={OPTIONS} value="short" onChange={() => {}} label="Direction" />);
    expect(screen.getByRole("button", { name: "Short" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Long" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the chosen value", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    const seen: string[] = [];
    render(
      <SegmentedControl
        options={OPTIONS}
        value="long"
        onChange={(v) => seen.push(v)}
        label="Direction"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Short" }));
    expect(seen).toEqual(["short"]);
  });
});

describe("ValidationMessage (§9.4, §2.8)", () => {
  it("is text inside a polite live region, not a colour", () => {
    const { container } = render(<ValidationMessage>Entry must be below the stop loss.</ValidationMessage>);
    expect(screen.getByText("Entry must be below the stop loss.")).toBeInTheDocument();
    // The live region is the paragraph, which wraps the message text.
    const live = container.querySelector("[aria-live]");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Entry must be below the stop loss.");
  });

  it("keeps the glyph decorative so the message is not read twice", () => {
    const { container } = render(<ValidationMessage>Bad</ValidationMessage>);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("Field (§9.4)", () => {
  it("wires the label to the control and the error through describedby", () => {
    render(
      <Field label="Entry price" required error="Entry must be below SL.">
        {({ controlId, describedBy }) => (
          <input id={controlId} aria-describedby={describedBy} aria-invalid />
        )}
      </Field>,
    );
    expect(screen.getByLabelText(/Entry price/)).toBeInTheDocument();
    // The error is reachable from the control, which is the whole point.
    expect(screen.getByLabelText(/Entry price/)).toHaveAccessibleDescription(
      "Entry must be below SL.",
    );
  });

  it("omits describedby entirely when there is neither helper nor error", () => {
    render(
      <Field label="Asset">
        {({ controlId, describedBy }) => <input id={controlId} aria-describedby={describedBy} />}
      </Field>,
    );
    expect(screen.getByLabelText("Asset")).not.toHaveAttribute("aria-describedby");
  });
});

describe("NumericInput (§11.1, §11.2)", () => {
  it("declares an explicit input mode", () => {
    render(<NumericInput id="n" value="113400" onChange={() => {}} />);
    // §9.4 requires an explicit input mode. React lowercases the attribute.
    expect(document.getElementById("n")).toHaveAttribute("inputmode", "decimal");
  });

  it("does not re-round or coerce what the caller supplied", () => {
    // §11.2: decimals follow the market convention; the client formats what it
    // is given. Coercing to number here would drop a trailing "." mid-entry.
    render(<NumericInput id="n" value="113400." onChange={() => {}} />);
    expect(document.getElementById("n")).toHaveValue("113400.");
  });
});

describe("Select (§9.4)", () => {
  it("renders one option per entry", () => {
    render(
      <Select
        id="s"
        value="btc"
        options={[
          { value: "btc", label: "BTC-PERP" },
          { value: "eth", label: "ETH-PERP" },
        ]}
        onChange={() => {}}
      />,
    );
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});

describe("LeverageStepper (§9.4)", () => {
  it("shows the permitted bounds", () => {
    render(<LeverageStepper id="lev" value={5} onChange={() => {}} min={1} max={20} />);
    expect(screen.getByText("1x – 20x")).toBeInTheDocument();
  });

  it("names each step button by the value it will produce", () => {
    render(<LeverageStepper id="lev" value={5} onChange={() => {}} min={1} max={20} />);
    expect(screen.getByRole("button", { name: "Increase to 6" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease to 4" })).toBeInTheDocument();
  });

  it("disables a step that would leave the permitted range", () => {
    render(<LeverageStepper id="lev" value={20} onChange={() => {}} min={1} max={20} />);
    expect(screen.getByRole("button", { name: "Increase to 20" })).toBeDisabled();
  });
});

describe("ExpiryControl (§9.4, §11.5)", () => {
  it("shows the absolute UTC time and a relative hint from one value", () => {
    // §9 rule 2: both forms derive from ONE value so they cannot drift.
    const when = new Date(Date.now() + 6 * 3_600_000).toISOString();
    render(<ExpiryControl id="exp" value={when} onChange={() => {}} />);
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
    expect(screen.getByText(/in \d+h/)).toBeInTheDocument();
  });

  it("degrades to a dash rather than throwing on an invalid value", () => {
    render(<ExpiryControl id="exp" value="not-a-date" onChange={() => {}} />);
    expect(screen.getByText(/—/)).toBeInTheDocument();
  });
});

describe("Checkbox and Toggle (§9.4)", () => {
  it("renders a checkbox with a real label association", () => {
    render(
      <Checkbox id="c" checked={false} onChange={() => {}} label="I authorize my own order" />,
    );
    expect(screen.getByLabelText("I authorize my own order")).toBeInTheDocument();
  });

  it("renders a toggle as a switch reporting its state", () => {
    render(<Toggle id="t" checked onChange={() => {}} label="Show account identity" />);
    expect(screen.getByRole("switch", { name: "Show account identity" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("is operable from the keyboard", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    const seen: boolean[] = [];
    render(<Toggle id="t" checked={false} onChange={(v) => seen.push(v)} label="Preference" />);
    screen.getByRole("switch").focus();
    await user.keyboard(" ");
    expect(seen).toEqual([true]);
  });
});

describe("TextInput and Textarea", () => {
  it("updates on change", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    const input = document.getElementById("t") as HTMLInputElement;
    await user.type(input, "11");
    expect(input.value).toBe("11");
  });

  it("renders a textarea", () => {
    render(<Textarea id="th" value="thesis" onChange={() => {}} />);
    expect(screen.getByDisplayValue("thesis")).toBeInTheDocument();
  });
});
