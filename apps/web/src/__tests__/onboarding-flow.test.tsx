import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingFlow } from "@/app/onboarding/OnboardingFlow";

/**
 * The wired onboarding flow (PRD §8.1): `/me` is the source of truth, so a
 * returning user never repeats a completed step. `clientGet`/`clientPost`
 * are mocked at the transport boundary with the LITERAL flat payload from
 * `apps/api/src/routes/auth.ts` — the previous crash shipped precisely
 * because tests mocked an invented nested shape.
 */

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
  clientPatch: (...a: unknown[]) => mockPost(...a),
}));

const ADDR = "0x1234567890abcdef1234567890abcdef12345678";

const X_ON = {
  provider: "x",
  connected: true,
  label: "X connected · @turnttfup99",
  displayOnly: false,
  handle: "turnttfup99",
};
const X_OFF = {
  provider: "x",
  connected: false,
  label: "X not connected",
  displayOnly: false,
  handle: null,
};
const HL_OFF = {
  provider: "hyperliquid",
  connected: false,
  label: "Hyperliquid not linked",
  displayOnly: false,
};
const HL_ON = {
  ...HL_OFF,
  connected: true,
  label: "Hyperliquid · 1 account(s)",
};
const ETHOS_OFF = {
  provider: "ethos",
  connected: false,
  label: "Ethos reputation not resolved",
  displayOnly: true,
};
const ETHOS_ON = {
  ...ETHOS_OFF,
  connected: true,
  label: "Ethos reputation resolved",
};

const base = {
  userId: "u1",
  displayName: null,
  tourCompletedAt: null,
  tradingAccounts: [],
};
const ME_X_ONLY = { ...base, profileSlug: null, connections: [X_ON, HL_OFF, ETHOS_OFF] };
const ME_NO_X = { ...base, profileSlug: null, connections: [X_OFF, HL_OFF, ETHOS_OFF] };
const ME_PROFILE = { ...base, profileSlug: "turnttfup99", connections: [X_ON, HL_OFF, ETHOS_OFF] };
const ME_WALLET = {
  ...base,
  profileSlug: "turnttfup99",
  connections: [X_ON, HL_ON, ETHOS_OFF],
  tradingAccounts: [{ id: "a1", accountAddress: ADDR, agentAddress: null, isPrimary: true }],
};
const ME_FULL = {
  ...base,
  profileSlug: "turnttfup99",
  connections: [X_ON, HL_ON, ETHOS_ON],
  tradingAccounts: [{ id: "a1", accountAddress: ADDR, agentAddress: null, isPrimary: true }],
};

let me: unknown = ME_X_ONLY;

beforeEach(() => {
  me = ME_X_ONLY;
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation(async () => me);
  mockPost.mockResolvedValue({});
});

describe("OnboardingFlow — step 1 reads /me through the shared selector", () => {
  it("does NOT render Connect X when the flat payload is already connected", async () => {
    render(<OnboardingFlow onNavigate={() => {}} />);
    expect(await screen.findByText("Create your PASS profile.")).toBeInTheDocument();
    expect(screen.queryByText("Connect your X identity.")).toBeNull();
  });

  it("DOES render Connect X when the x connection is absent", async () => {
    me = ME_NO_X;
    const onNavigate = vi.fn();
    render(<OnboardingFlow onNavigate={onNavigate} />);
    expect(await screen.findByText("Connect your X identity.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect X" }));
    expect(onNavigate).toHaveBeenCalledWith("/api/v1/auth/x/start");
  });
});

describe("OnboardingFlow — profile step", () => {
  it("submits slug, display name and bio, then advances", async () => {
    render(<OnboardingFlow onNavigate={() => {}} />);
    await screen.findByText("Create your PASS profile.");
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "turnttfup99" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Turntt" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "BTC swings." } });
    me = ME_PROFILE;
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("/api/v1/profiles", {
        slug: "turnttfup99",
        displayName: "Turntt",
        bio: "BTC swings.",
      }),
    );
    // D-023: profile advances straight to Ethos — no wallet step exists.
    expect(await screen.findByText("Resolve your Ethos reputation.")).toBeInTheDocument();
  });

  it("rejects an invalid slug locally without posting", async () => {
    render(<OnboardingFlow onNavigate={() => {}} />);
    await screen.findByText("Create your PASS profile.");
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "AB" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Turntt" } });
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/3–32|lowercase/);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("surfaces a taken slug from the API", async () => {
    mockPost.mockRejectedValue(new Error("That handle is already taken."));
    render(<OnboardingFlow onNavigate={() => {}} />);
    await screen.findByText("Create your PASS profile.");
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "takenname" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Taken" } });
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That handle is already taken.");
  });
});

describe("OnboardingFlow — D-023, no wallet step", () => {
  it("walks X → profile → Ethos → handoff with no wallet UI anywhere", async () => {
    const { container } = render(<OnboardingFlow onNavigate={() => {}} />);
    // Profile step (X already connected in the default fixture).
    await screen.findByText("Create your PASS profile.");
    expect(screen.queryByText("Associate your Hyperliquid account.")).toBeNull();
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "turnttfup99" } });
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Turntt" } });
    me = ME_PROFILE;
    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    await screen.findByText("Resolve your Ethos reputation.");
    expect(screen.queryByText("Connect wallet")).toBeNull();
    expect(screen.queryByText("Link wallet account")).toBeNull();
    mockPost.mockResolvedValue({
      providerProfileId: "ethos-1",
      credibilityScore: 720,
      reviewsCount: 0,
      vouchesCount: 0,
      disclaimer: "Community sentiment, not a verdict.",
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolve Ethos" }));
    expect(await screen.findByText("Community sentiment, not a verdict.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/You're set/)).toBeInTheDocument();
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of ["hyperliquid", "connect wallet", "agent wallet"]) {
      expect(html).not.toContain(forbidden);
    }
  });
});

describe("OnboardingFlow — ethos step and handoff", () => {
  it("shows the score with the disclaimer on success", async () => {
    me = ME_WALLET;
    mockPost.mockResolvedValue({
      providerProfileId: "ethos-1",
      credibilityScore: 720,
      reviewsCount: 3,
      vouchesCount: 1,
      disclaimer: "Community sentiment, not a verdict.",
    });
    render(<OnboardingFlow onNavigate={() => {}} />);
    await screen.findByText("Resolve your Ethos reputation.");
    fireEvent.click(screen.getByRole("button", { name: "Resolve Ethos" }));
    expect(await screen.findByText(/720/)).toBeInTheDocument();
    expect(screen.getByText("Community sentiment, not a verdict.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/You're set/)).toBeInTheDocument();
  });

  it("shows the later state on failure and still continues", async () => {
    me = ME_WALLET;
    mockPost.mockRejectedValue(new Error("Ethos is down"));
    render(<OnboardingFlow onNavigate={() => {}} />);
    await screen.findByText("Resolve your Ethos reputation.");
    fireEvent.click(screen.getByRole("button", { name: "Resolve Ethos" }));
    expect(await screen.findByText(/later/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/You're set/)).toBeInTheDocument();
  });

  it("hands off with Explore Passes linking to /discover", async () => {
    me = ME_FULL;
    render(<OnboardingFlow onNavigate={() => {}} />);
    expect(await screen.findByText(/You're set/)).toBeInTheDocument();
    const explore = screen.getByRole("link", { name: "Explore Passes" });
    expect(explore).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "See my profile" })).toHaveAttribute(
      "href",
      "/u/turnttfup99",
    );
  });

  it("goes back to the previous step", async () => {
    render(<OnboardingFlow onNavigate={() => {}} />);
    await screen.findByText("Create your PASS profile.");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Connect your X identity.")).toBeInTheDocument();
  });
});
