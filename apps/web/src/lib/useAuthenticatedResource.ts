"use client";

/**
 * useAuthenticatedResource — the single data-loading path for every
 * authenticated screen.
 *
 * WHY THIS EXISTS
 *
 * Every authenticated screen needs the same five states, and before this hook
 * each screen fetched for itself. That made two things true, and both are
 * defects:
 *
 *  - A screen's unauthorized state could only be reached by REJECTING a mocked
 *    client promise. In this runner that rejection is reported as an unhandled
 *    rejection and fails the whole test FILE, even though the component catches
 *    it. Six approaches were tried across three sessions; none worked. So the
 *    unauthorized and error states were untestable, and four screens were blocked
 *    on it.
 *  - Each screen re-derived the same empty/loading/error branching, so they
 *    drifted.
 *
 * The fix is to make the state a VALUE rather than an outcome of a promise:
 *
 *  - `probe` is injectable, so a test can resolve `false` and reach the
 *    unauthorized state with NO rejection anywhere.
 *  - `AuthenticatedView` is pure: it renders a state object and nothing else, so
 *    all five branches are assertable without touching a promise.
 *
 * The hook never rejects to its caller. Every failure is mapped to a state.
 *
 * CALLBACK IDENTITY
 *
 * `load`/`probe`/`isEmpty` are read through a ref and the fetch runs on mount
 * only. Holding them in the effect's dependency list would loop forever, because
 * callers naturally pass inline arrow functions that are a new reference on
 * every render — each new `run` retriggers the effect, which re-renders, which
 * makes them new again. To refetch, call `reload()`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { clientGet } from "@/lib/client";

export type Resource<T> =
  | { status: "loading" }
  | { status: "unauthorized" }
  | { status: "error"; error: string }
  | { status: "empty" }
  | { status: "ready"; data: T };

export interface AuthenticatedResourceOptions<T> {
  /**
   * Fetches the resource. May reject; the hook catches it and maps the failure to
   * `error`, never surfacing the rejection to the caller.
   */
  load: () => Promise<T>;
  /**
   * Resolves TRUE when a session exists. Defaults to probing `/api/v1/me`.
   *
   * Injectable so a test reaches `unauthorized` by RESOLVING false rather than by
   * rejecting, which is what makes the state assertable at all.
   */
  probe?: () => Promise<boolean>;
  /** Decides whether loaded data counts as empty. */
  isEmpty?: (data: T) => boolean;
}

export interface AuthenticatedResource<T> {
  state: Resource<T>;
  /** Refetches, for the Retry affordance on the `error` branch. */
  reload: () => void;
}

/** Default session probe. Resolves a boolean and never rejects. */
async function defaultProbe(): Promise<boolean> {
  try {
    await clientGet("/api/v1/me");
    return true;
  } catch {
    return false;
  }
}

export function useAuthenticatedResource<T>({
  load,
  probe = defaultProbe,
  isEmpty,
}: AuthenticatedResourceOptions<T>): AuthenticatedResource<T> {
  const [state, setState] = useState<Resource<T>>({ status: "loading" });

  // Latest-value refs, so the mount-once effect never depends on identity.
  const latest = useRef({ load, probe, isEmpty });
  latest.current = { load, probe, isEmpty };

  // Monotonic token: bumped by reload() to retrigger the mount effect.
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;

    void (async () => {
      setState({ status: "loading" });

      const { load: doLoad, probe: doProbe, isEmpty: doEmpty } = latest.current;

      let authorized = false;
      try {
        // probe is contractually non-rejecting; this catch is belt and braces so a
        // misbehaving probe degrades to unauthorized rather than crashing.
        authorized = await doProbe();
      } catch {
        authorized = false;
      }
      if (!live) return;
      if (!authorized) {
        setState({ status: "unauthorized" });
        return;
      }

      let data: T;
      try {
        data = await doLoad();
      } catch (e) {
        if (!live) return;
        setState({
          status: "error",
          error: e instanceof Error ? e.message : "Request failed",
        });
        return;
      }
      if (!live) return;

      if (doEmpty?.(data)) {
        setState({ status: "empty" });
        return;
      }
      setState({ status: "ready", data });
    })();

    // A reload supersedes an in-flight request, and unmounting must not set state.
    return () => {
      live = false;
    };
  }, [attempt]);

  return { state, reload };
}