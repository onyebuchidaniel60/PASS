import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnboardingClient, STEPS, type StepId } from "@/app/onboarding/OnboardingClient";

/** §10.11 / PRD §8.1. One step per screen, never a single four-field form. */

describe("Onboarding (§10.11)", () => {
  it("declares exactly the four PRD §8.1 steps, in order", () => {
    expect(STEPS.map((s) => s.id)).toEqual(["x", "profile", "hyperliquid", "ethos"]);
  });

  it("marks only Ethos skippable, because only Ethos is 'if available'", () => {
    const optional = STEPS.filter((s) => s.optional).map((s) => s.id);
    expect(optional).toEqual(["ethos"]);
  });

  it("shows one step, not a combined form", () => {
    render(<OnboardingClient step={0} />);
    expect(screen.getByText("Connect your X identity.")).toBeInTheDocument();
    expect(screen.queryByText("Create your PASS profile.")).toBeNull();
    expect(screen.queryByText("Resolve your Ethos reputation.")).toBeNull();
  });

  it("renders progress as mono STEP n / 4 (§10.11)", () => {
    render(<OnboardingClient step={1} />);
    expect(screen.getByText("STEP 2 / 4")).toBeInTheDocument();
  });

  it("renders each step's question, action and single-sentence why", () => {
    for (const [index, step] of STEPS.entries()) {
      const view = render(<OnboardingClient step={index} />);
      expect(screen.getByText(step.question)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: step.action })).toBeInTheDocument();
      // ONE sentence of justification. An essay here would read as a consent wall.
      expect(screen.getByText(step.why)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("names the action for what it does, not 'Continue'", () => {
    for (const step of STEPS) {
      expect(step.action).not.toMatch(/^(continue|next|submit|ok)$/i);
    }
  });

  it("runs the step action and reports a failure on THAT step only", async () => {
    const onAction = vi.fn().mockRejectedValue(new Error("X rejected the handshake"));
    render(<OnboardingClient step={0} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect X" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("X rejected the handshake");
    expect(onAction).toHaveBeenCalledWith("x");
    // The question is still standing; the other steps were never disturbed.
    expect(screen.getByText("Connect your X identity.")).toBeInTheDocument();
  });

  it("offers no Skip on a required step", () => {
    render(<OnboardingClient step={0} />);
    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();
  });

  it("offers Skip on the optional step, and wires it up", () => {
    const onSkip = vi.fn();
    render(<OnboardingClient step={3} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(onSkip).toHaveBeenCalledWith("ethos");
  });

  it("shows UnavailableBlock when the provider cannot be reached, and still allows skipping", () => {
    render(
      <OnboardingClient
        step={3}
        progress={[{ step: "ethos", complete: false, unavailable: true }]}
      />,
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    // An unavailable provider does not render its action — it could not work.
    expect(screen.queryByRole("button", { name: "Resolve Ethos" })).toBeNull();
  });

  it("does not offer Skip when a REQUIRED provider is unavailable", () => {
    render(
      <OnboardingClient
        step={2}
        progress={[{ step: "hyperliquid", complete: false, unavailable: true }]}
      />,
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();
  });

  it("blocks a later step when the session is gone", async () => {
    render(<OnboardingClient step={2} probe={async () => false} />);
    expect(
      await screen.findByText("Finish connecting X to continue onboarding."),
    ).toBeInTheDocument();
  });

  it("keeps step 1 reachable while signed out — connecting X is the point of it", () => {
    render(<OnboardingClient step={0} probe={async () => false} />);
    expect(screen.getByText("Connect your X identity.")).toBeInTheDocument();
  });

  it("surfaces a progress error on the matching step", () => {
    const errors: Record<StepId, string> = {
      x: "",
      profile: "",
      hyperliquid: "Account not found.",
      ethos: "",
    };
    render(
      <OnboardingClient
        step={2}
        progress={[
          { step: "x", complete: true },
          { step: "profile", complete: true },
          { step: "hyperliquid", complete: false, error: errors.hyperliquid },
        ]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Account not found.");
  });
});

describe("Onboarding — no key material, ever", () => {
  it("requests nothing that could be a secret", () => {
    const { container } = render(<OnboardingClient step={2} />);
    expect(container.querySelector('input[type="password"]')).toBeNull();
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of ["private key", "seed phrase", "mnemonic"]) {
      expect(html).not.toContain(forbidden);
    }
  });
});