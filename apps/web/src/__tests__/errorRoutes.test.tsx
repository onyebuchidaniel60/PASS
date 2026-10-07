import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NotFound from "../app/not-found";
import ErrorBoundary from "../app/error";
import { StalePassClient } from "../app/passes/[publicId]/stale/StalePassClient";

/**
 * §10.12 error and not-found, and §10.7 the stale interstitial route.
 *
 * These are small surfaces, so the assertions are about TONE and about what is
 * NOT shown: §1.2 requires calm failure with no exclamation marks, and §10.12
 * forbids a stack trace or an error code as the headline.
 */
describe("Not found (§10.12)", () => {
  it("states the absence plainly at display size", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "This page does not exist." }),
    ).toBeInTheDocument();
  });

  it("offers a way onward", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Explore Passes" })).toHaveAttribute(
      "href",
      "/discover",
    );
  });

  it("shows no stack trace, no error code headline, and no exclamation mark", () => {
    const { container } = render(<NotFound />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("!");
    expect(text).not.toMatch(/at\s+\w+\s+\(/);
    expect(text.toLowerCase()).not.toContain("oops");
  });
});

describe("Error boundary (§10.12)", () => {
  it("states what failed and offers Retry", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={() => {}} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Something failed." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("never renders the provider message, which may carry data", () => {
    const { container } = render(
      <ErrorBoundary
        error={new Error("db password is hunter2")}
        reset={() => {}}
      />,
    );
    expect(container.textContent).not.toContain("hunter2");
  });

  it("shows a reference id when the framework supplies a digest", () => {
    render(<ErrorBoundary error={Object.assign(new Error("x"), { digest: "abc123" })} reset={() => {}} />);
    expect(screen.getByText(/Reference abc123/)).toBeInTheDocument();
  });

  it("invokes reset when Retry is pressed", () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error("x")} reset={reset} />);
    screen.getByRole("button", { name: "Retry" }).click();
    expect(reset).toHaveBeenCalled();
  });
});

describe("Stale Pass route (§10.7)", () => {
  it("states the change and the supplied copy verbatim", () => {
    render(<StalePassClient publicId="UvvuxpWPZ4" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "This Pass changed." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The trade parameters you reviewed are no longer current."),
    ).toBeInTheDocument();
  });

  it("links to the latest Pass and to Discover", () => {
    render(<StalePassClient publicId="UvvuxpWPZ4" />);
    expect(screen.getByRole("link", { name: "Review latest Pass" })).toHaveAttribute(
      "href",
      "/p/UvvuxpWPZ4",
    );
    expect(screen.getByRole("link", { name: "Explore Passes" })).toBeInTheDocument();
  });

  it("offers NO path into the Take flow — stale parameters are never executed", () => {
    const { container } = render(<StalePassClient publicId="UvvuxpWPZ4" />);
    expect(container.querySelectorAll('a[href*="/take"]')).toHaveLength(0);
    expect(screen.getByText(/Nothing was executed/)).toBeInTheDocument();
  });

  it("opens the change dialog on request", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    render(<StalePassClient publicId="UvvuxpWPZ4" />);
    await user.click(screen.getByRole("button", { name: "View what changed" }));
    expect(screen.getByRole("dialog", { name: "This Pass changed." })).toBeInTheDocument();
  });
});