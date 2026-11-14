import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("Legal pages", () => {
  it("renders the Terms of Service linked from the footer", () => {
    render(<TermsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service." }),
    ).toBeInTheDocument();
    expect(screen.getByText(/non-custodial social execution layer/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Eligibility and risk" })).toBeInTheDocument();
  });

  it("renders the Privacy Policy linked from the footer", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy." }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never asks for and never stores/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your choices" })).toBeInTheDocument();
  });
});
