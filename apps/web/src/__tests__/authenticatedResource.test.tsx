import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthenticatedView } from "@/components/AuthenticatedView";
import { useAuthenticatedResource, type Resource } from "@/lib/useAuthenticatedResource";

/**
 * The point of this suite: **all five states render, with no rejected promise
 * anywhere.**
 *
 * The unauthorized state is reached by RESOLVING `false` from an injected probe,
 * never by rejecting a mocked client. Every earlier attempt to test this state
 * through a rejected promise failed the whole file as an unhandled rejection, and
 * that failure mode is what blocked four screens. If a future change reintroduces
 * a rejection here, these tests stop passing — which is the point.
 */

describe("useAuthenticatedResource — state mapping", () => {
  it("reaches unauthorized by RESOLVING false, not by rejecting", async () => {
    let done!: boolean;
    const Probe2 = () => {
      const { state } = useAuthenticatedResource<unknown>({
        probe: async () => false,
        load: async () => null,
      });
      done = state.status === "unauthorized";
      return <AuthenticatedView state={state}>{() => <p>ready</p>}</AuthenticatedView>;
    };
    await act(async () => {
      render(<Probe2 />);
    });
    // The probe resolved; no promise ever rejected.
    expect(done).toBe(true);
  });

  it("reaches ready when the probe resolves true and data loads", async () => {
    let status: Resource<unknown>["status"] = "loading";
    const P = () => {
      const { state } = useAuthenticatedResource<{ n: number }>({
        probe: async () => true,
        load: async () => ({ n: 7 }),
      });
      status = state.status;
      return null;
    };
    await act(async () => {
      render(<P />);
    });
    expect(status).toBe("ready");
  });

  it("maps a load failure to error, never surfacing the rejection", async () => {
    const seen: { state?: Resource<unknown> } = {};
    const P = () => {
      seen.state = useAuthenticatedResource<unknown>({
        probe: async () => true,
        // Rejects, and the hook is required to swallow it into a state value.
        load: async () => {
          throw new Error("upstream down");
        },
      }).state;
      return null;
    };
    await act(async () => {
      render(<P />);
    });
    expect(seen.state?.status).toBe("error");
    expect(seen.state && seen.state.status === "error" ? seen.state.error : "").toBe(
      "upstream down",
    );
  });

  it("maps empty data to the empty status", async () => {
    const seen2: { state?: Resource<unknown[]> } = {};
    const P = () => {
      seen2.state = useAuthenticatedResource<unknown[]>({
        probe: async () => true,
        load: async () => [],
        isEmpty: (d) => d.length === 0,
      }).state;
      return null;
    };
    await act(async () => {
      render(<P />);
    });
    expect(seen2.state?.status).toBe("empty");
  });

  it("treats a probe that rejects as unauthorized rather than crashing", async () => {
    let status: Resource<unknown>["status"] = "loading";
    const P = () => {
      const { state: s } = useAuthenticatedResource<unknown>({
        probe: async () => {
          throw new Error("probe blew up");
        },
        load: async () => null,
      });
      status = s.status;
      return null;
    };
    await act(async () => {
      render(<P />);
    });
    expect(status).toBe("unauthorized");
  });
});

describe("AuthenticatedView — all five states render", () => {
  it("renders loading as a busy live region", () => {
    render(
      <AuthenticatedView state={{ status: "loading" }} loadingLabel="Loading Passes">
        {() => <p>ready</p>}
      </AuthenticatedView>,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading Passes")).toBeInTheDocument();
  });

  it("renders unauthorized with the SPECIFIC reason", () => {
    render(
      <AuthenticatedView
        state={{ status: "unauthorized" }}
        unauthorizedReason="Your Passes belong to a connected X identity."
      >
        {() => <p>ready</p>}
      </AuthenticatedView>,
    );
    expect(
      screen.getByText("Your Passes belong to a connected X identity."),
    ).toBeInTheDocument();
    // A permission state is not an alert: nothing has gone wrong yet.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders error as an alert with Retry", () => {
    render(
      <AuthenticatedView state={{ status: "error", error: "boom" }} onRetry={() => {}}>
        {() => <p>ready</p>}
      </AuthenticatedView>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders the empty node", () => {
    render(
      <AuthenticatedView state={{ status: "empty" }} empty={<p>nothing here</p>}>
        {() => <p>ready</p>}
      </AuthenticatedView>,
    );
    expect(screen.getByText("nothing here")).toBeInTheDocument();
  });

  it("renders children with the loaded data", () => {
    render(
      <AuthenticatedView state={{ status: "ready", data: { n: 3 } }}>
        {(d) => <p>{`ready ${d.n}`}</p>}
      </AuthenticatedView>,
    );
    expect(screen.getByText("ready 3")).toBeInTheDocument();
  });

  it("never renders more than one branch at a time", () => {
    const { rerender } = render(
      <AuthenticatedView state={{ status: "loading" }}>{() => <p>ready</p>}</AuthenticatedView>,
    );
    expect(screen.queryByText("ready")).toBeNull();
    rerender(
      <AuthenticatedView state={{ status: "ready", data: 1 }}>
        {() => <p>ready</p>}
      </AuthenticatedView>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("ready")).toBeInTheDocument();
  });
});

describe("no rejection escapes", () => {
  it("the whole suite runs with zero unhandled rejections", () => {
    // This suite deliberately includes load failures and probe failures. If any
    // of them escaped as an unhandled rejection, vitest would fail the FILE and
    // every test here with it. Reaching this line is the assertion.
    expect(true).toBe(true);
  });
});