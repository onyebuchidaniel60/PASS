import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingGate } from "@/components/OnboardingGate";

/**
 * The single first-visit gate (mounted once in the root layout). Redirects
 * fire from settled state only — never on a loading guess — via replace so
 * the intercepted route never enters the back stack.
 */

const { mockGet, mockReplace } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockReplace: vi.fn(),
}));

let path = "/discover";

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: vi.fn(),
  clientPatch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => path,
}));

const withProfile = { profileSlug: "turnttfup99" };
const withoutProfile = { profileSlug: null };

beforeEach(() => {
  path = "/discover";
  mockGet.mockReset();
  mockReplace.mockReset();
});

async function settled() {
  await waitFor(() => expect(mockGet).toHaveBeenCalled());
  await waitFor(() => new Promise((r) => setTimeout(r, 0)));
}

describe("OnboardingGate", () => {
  it("redirects a profile-less session to /onboarding from anywhere", async () => {
    mockGet.mockResolvedValue(withoutProfile);
    path = "/discover";
    render(<OnboardingGate />);
    await settled();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"));
  });

  it("leaves a completed user alone", async () => {
    mockGet.mockResolvedValue(withProfile);
    const { container } = render(<OnboardingGate />);
    await settled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("leaves a signed-out visitor on public routes alone", async () => {
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    render(<OnboardingGate />);
    await settled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor off /onboarding to landing", async () => {
    mockGet.mockRejectedValue(new Error("AUTH_REQUIRED"));
    path = "/onboarding";
    render(<OnboardingGate />);
    await settled();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("sends a completed user off /onboarding to the main app", async () => {
    mockGet.mockResolvedValue(withProfile);
    path = "/onboarding";
    render(<OnboardingGate />);
    await settled();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/discover"));
  });

  it("keeps a profile-less user on /onboarding", async () => {
    mockGet.mockResolvedValue(withoutProfile);
    path = "/onboarding";
    render(<OnboardingGate />);
    await settled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
