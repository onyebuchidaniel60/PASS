import { render, screen } from "@testing-library/react";

/**
 * Harness smoke test.
 *
 * Its only job is to prove the DOM harness works before any component depends
 * on it: JSX transforms, React mounts, jest-dom matchers register, and the
 * include pattern matches a file under apps/web/src. If this fails, no other
 * web test result means anything.
 */
describe("web DOM test harness", () => {
  it("renders a React element into the DOM", () => {
    render(<div data-testid="probe">PASS</div>);
    expect(screen.getByTestId("probe")).toBeInTheDocument();
  });

  it("registers the jest-dom matchers", () => {
    render(<button type="button">Take Pass</button>);
    const button = screen.getByRole("button", { name: "Take Pass" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Take Pass");
  });

  it("exposes matchMedia so reduced-motion paths are reachable", () => {
    expect(typeof window.matchMedia).toBe("function");
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false);
  });
});
