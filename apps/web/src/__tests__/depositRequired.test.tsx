import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DepositRequiredCard,
  isDepositRequiredError,
} from "@/components/DepositRequiredCard";

describe("Deposit-required error handling", () => {
  it("recognises the venue's deposit rejection in wrapped messages", () => {
    expect(
      isDepositRequiredError("Must deposit before performing actions"),
    ).toBe(true);
    expect(
      isDepositRequiredError(
        "PROVIDER_ERROR: Must deposit before performing actions.",
      ),
    ).toBe(true);
    expect(isDepositRequiredError("Insufficient margin")).toBe(false);
    expect(isDepositRequiredError(null)).toBe(false);
  });

  it("renders the funding action card, not the raw venue string", () => {
    const onRetry = vi.fn();
    render(<DepositRequiredCard onRetry={onRetry} />);
    expect(
      screen.getByText("Action Required: Deposit Funds on Hyperliquid"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your trading account is currently empty. You must deposit USDC before you can take a trade.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Once you have deposited, click Retry below."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to Hyperliquid to Deposit" }),
    ).toHaveAttribute("href", "https://app.hyperliquid.xyz");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
