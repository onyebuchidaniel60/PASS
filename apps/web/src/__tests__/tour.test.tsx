import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Tour, TOUR_STEPS } from "@/components/Tour";
import { TourGate } from "@/components/TourGate";

/**
 * First-time tour (D-022): text plus Next/Back/Skip, nothing else. Skip and
 * Done both record completion through `onDone`. No animation anywhere, so
 * the reduced-motion path is the only path.
 */
describe("Tour", () => {
  it("declares four to six steps, each one heading plus one paragraph", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(4);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(6);
    for (const step of TOUR_STEPS) {
      expect(step.heading.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it("walks Next and Back through the steps", () => {
    render(<Tour onDone={() => {}} />);
    expect(screen.getByText(TOUR_STEPS[0].heading)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(TOUR_STEPS[1].heading)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(TOUR_STEPS[0].heading)).toBeInTheDocument();
  });

  it("shows Done on the last step and records completion", () => {
    const onDone = vi.fn();
    render(<Tour onDone={onDone} />);
    for (let i = 0; i < TOUR_STEPS.length - 1; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Skip records completion too", () => {
    const onDone = vi.fn();
    render(<Tour onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders with no animation inline styles (reduced-motion safe)", () => {
    const { container } = render(<Tour onDone={() => {}} />);
    const overlay = container.querySelector("[data-pass-overlay]");
    expect(overlay).not.toBeNull();
    const styled = Array.from(container.querySelectorAll("[style]"));
    for (const node of styled) {
      const style = (node as HTMLElement).getAttribute("style") ?? "";
      expect(style).not.toMatch(/animation|transition/i);
    }
  });
});

const { mockMeGet, mockMePatch } = vi.hoisted(() => ({
  mockMeGet: vi.fn(),
  mockMePatch: vi.fn(),
}));

let gatePath = "/discover";

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockMeGet(...a),
  clientPost: vi.fn(),
  clientPatch: (...a: unknown[]) => mockMePatch(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => gatePath,
}));

const gateMe = (over: Record<string, unknown> = {}) => ({
  userId: "u1",
  profileSlug: "turnttfup99",
  displayName: "Turntt",
  tourCompletedAt: null,
  connections: [],
  tradingAccounts: [],
  ...over,
});

beforeEach(() => {
  gatePath = "/discover";
  mockMeGet.mockReset();
  mockMePatch.mockReset();
});

describe("TourGate", () => {
  it("shows the tour once: profile complete, never completed", async () => {
    mockMeGet.mockResolvedValue(gateMe());
    render(<TourGate />);
    expect(await screen.findByText(TOUR_STEPS[0].heading)).toBeInTheDocument();
  });

  it("hides when the tour is completed", async () => {
    mockMeGet.mockResolvedValue(gateMe({ tourCompletedAt: "2026-10-09T00:00:00Z" }));
    const { container } = render(<TourGate />);
    await waitFor(() => expect(mockMeGet).toHaveBeenCalled());
    await waitFor(() => new Promise((r) => setTimeout(r, 0)));
    expect(container).toBeEmptyDOMElement();
  });

  it("hides without a profile and on /onboarding", async () => {
    mockMeGet.mockResolvedValue(gateMe({ profileSlug: null }));
    const { container } = render(<TourGate />);
    await waitFor(() => expect(mockMeGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("Done records completion through PATCH and hides", async () => {
    let current: unknown = gateMe();
    mockMeGet.mockImplementation(async () => current);
    mockMePatch.mockImplementation(async () => {
      current = gateMe({ tourCompletedAt: "2026-10-09T00:00:00Z" });
      return {};
    });
    render(<TourGate />);
    expect(await screen.findByText(TOUR_STEPS[0].heading)).toBeInTheDocument();
    for (let i = 0; i < TOUR_STEPS.length - 1; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(mockMePatch).toHaveBeenCalledWith(
        "/api/v1/profiles/me",
        expect.objectContaining({ tourCompletedAt: expect.any(String) }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText(TOUR_STEPS[0].heading)).toBeNull(),
    );
  });
});
