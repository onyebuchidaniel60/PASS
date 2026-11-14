import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MobileMenu } from "@/components/MobileMenu";

let currentPath = "/discover";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

beforeEach(() => {
  currentPath = "/discover";
});

describe("MobileMenu", () => {
  it("opens a full-screen dialog with the four primary destinations", () => {
    render(<MobileMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const dialog = screen.getByRole("dialog", { name: "Menu" });
    const nav = within(dialog).getByRole("navigation", {
      name: "Mobile primary",
    });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "Discover" })).toHaveAttribute(
      "href",
      "/discover",
    );
    expect(within(nav).getByRole("link", { name: "Discover" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "My Passes" })).toHaveAttribute(
      "href",
      "/me/passes",
    );
    expect(within(nav).getByRole("link", { name: "Executions" })).toHaveAttribute(
      "href",
      "/me/executions",
    );
    expect(within(nav).getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<MobileMenu />);
    const trigger = screen.getByRole("button", { name: "Open menu" });
    // A real pointer press focuses the trigger before the dialog opens; the
    // primitive records that element so it can restore focus on close.
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Menu" }), {
      key: "Escape",
    });

    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
