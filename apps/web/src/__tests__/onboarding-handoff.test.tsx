import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "@/app/onboarding/OnboardingFlow";
import { OnboardingGate } from "@/components/OnboardingGate";
import { notifyMeChanged, onMeChanged } from "@/lib/me-events";

/**
 * Onboarding completion regression (Stage B).
 *
 * Fresh users completed all three steps yet never entered the app: the
 * root-layout gate reads /me once on mount and never refreshes it, so after
 * in-flow profile creation its snapshot still reported onboarding-incomplete
 * and its pathname-driven effect bounced every client-side arrival at
 * /discover back to /onboarding — where the remounted flow (local ethos
 * state reset) dropped the user a step back. Every test here FAILS against
 * that shape and passes once profile creation refreshes identity readers.
 */

const { mockGet, mockPost, mockReplace, mockRouter } = vi.hoisted(() => {
  const replace = vi.fn();
  return {
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockReplace: replace,
    mockRouter: { replace, push: vi.fn() },
  };
});

let path = "/onboarding";

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
  clientPatch: (...a: unknown[]) => mockPost(...a),
}));

vi.mock("next/navigation", () => ({
  // Stable router object: next/navigation returns one router instance, so
  // the gate's redirect effect fires on state/pathname change only. A fresh
  // literal per useRouter() call would re-fire the effect on every render
  // and manufacture redirects the product never performs.
  useRouter: () => mockRouter,
  usePathname: () => path,
}));

const X_ON = {
  provider: "x",
  connected: true,
  label: "X connected · @freshuser",
  displayOnly: false,
  handle: "freshuser",
};
const ETHOS_OFF = {
  provider: "ethos",
  connected: false,
  label: "Ethos reputation not resolved",
  displayOnly: true,
};

const base = { userId: "fresh-1", displayName: null, tourCompletedAt: null, tradingAccounts: [] };
const ME_FRESH = { ...base, profileSlug: null, connections: [X_ON, ETHOS_OFF] };
const ME_PROFILED = { ...base, profileSlug: "freshuser", connections: [X_ON, ETHOS_OFF] };

let me: unknown = ME_FRESH;

beforeEach(() => {
  path = "/onboarding";
  me = ME_FRESH;
  mockGet.mockReset();
  mockPost.mockReset();
  mockReplace.mockReset();
  mockGet.mockImplementation(async () => me);
  mockPost.mockResolvedValue({});
});

async function walkToHandoff() {
  const { unmount } = render(<OnboardingFlow onNavigate={() => {}} />);
  await screen.findByText("Create your PASS profile.");
  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "freshuser" } });
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Fresh" } });
  me = ME_PROFILED;
  // Two clicks in the same tick (no render between them): one user gesture
  // must still submit exactly once. Raw dispatches, not fireEvent — fireEvent
  // flushes act() between clicks, which hides the pre-render race.
  const profileBtn = screen.getByRole("button", { name: "Create profile" });
  profileBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  profileBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await screen.findByText("Resolve your Ethos reputation.");
  mockPost.mockResolvedValue({
    providerProfileId: "ethos:1",
    credibilityScore: 1200,
    reviewsCount: 0,
    vouchesCount: 0,
    disclaimer: "Community sentiment, not a verdict.",
  });
  // Same-tick double for the ethos submit (no act flush between clicks).
  const ethosBtn = screen.getByRole("button", { name: "Resolve Ethos" });
  ethosBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  ethosBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  await screen.findByText("Community sentiment, not a verdict.");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("link", { name: "Explore Passes" });
  return { unmount };
}

describe("onboarding completion", () => {
  it("walks all three steps to the handoff with exactly one submit per step", async () => {
    await walkToHandoff();
    expect(
      mockPost.mock.calls.filter(([url]) => url === "/api/v1/profiles"),
    ).toHaveLength(1);
    expect(
      mockPost.mock.calls.filter(([url]) => url === "/api/v1/integrations/ethos/refresh"),
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Explore Passes" })).toHaveAttribute(
      "href",
      "/discover",
    );
  });

  it("profile creation notifies identity readers (gate refresh signal)", async () => {
    const seen: number[] = [];
    const off = onMeChanged(() => seen.push(1));
    try {
      render(<OnboardingFlow onNavigate={() => {}} />);
      await screen.findByText("Create your PASS profile.");
      fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "freshuser" } });
      fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Fresh" } });
      me = ME_PROFILED;
      fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
      await screen.findByText("Resolve your Ethos reputation.");
      expect(seen.length).toBeGreaterThan(0);
    } finally {
      off();
    }
  });

  it("the gate re-reads on identity change and stops bouncing /discover", async () => {
    // Mount stale (profile-less) on /discover: the pre-fix gate redirects…
    path = "/discover";
    render(<OnboardingGate />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"));
    const callsAfterBounce = mockGet.mock.calls.length;
    expect(callsAfterBounce).toBeGreaterThan(0);
    // …then the profile write lands and notifies: the gate must re-read…
    me = ME_PROFILED;
    const { act } = await import("@testing-library/react");
    await act(async () => {
      notifyMeChanged();
    });
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callsAfterBounce));
    // …and with a profile present it issues no further redirect.
    await waitFor(() => new Promise((r) => setTimeout(r, 50)));
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it("completion persists across a reload: completed steps are not re-entered", async () => {
    const { unmount } = await walkToHandoff();
    // A reload is a remount with a fresh server read (profile row persisted).
    unmount();
    render(<OnboardingFlow onNavigate={() => {}} />);
    await waitFor(() =>
      expect(screen.queryByText("Create your PASS profile.")).toBeNull(),
    );
    expect(mockPost.mock.calls.filter(([url]) => url === "/api/v1/profiles")).toHaveLength(1);
  });

  it("a validation failure surfaces inline: no post, no navigation", async () => {
    render(<OnboardingFlow onNavigate={() => {}} />);
    await screen.findByText("Create your PASS profile.");
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "AB" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Fresh" } });
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/3–32|lowercase/);
    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.queryByText("Resolve your Ethos reputation.")).toBeNull();
  });
});
