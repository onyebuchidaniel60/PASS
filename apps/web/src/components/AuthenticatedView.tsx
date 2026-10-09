"use client";

/**
 * AuthenticatedView — the pure presentation half of the authenticated screen
 * pattern.
 *
 * Given a `Resource<T>` it renders exactly one of five branches. It performs no
 * fetching and holds no state of its own, so every branch is assertable by
 * rendering a state object directly. That is what makes the unauthorized and
 * error states testable without a rejected promise, which is the entire reason
 * `useAuthenticatedResource` exists.
 */

import type { ReactNode } from "react";

import { EmptyBlock, ErrorBlock, LoadingBlock, PermissionBlock } from "@/components/wave3/data";

import type { Resource } from "@/lib/useAuthenticatedResource";

export interface AuthenticatedViewProps<T> {
  state: Resource<T>;
  /** Rendered for `ready`. Receives the loaded data. */
  children: (data: T) => ReactNode;
  /** Rendered for `empty`. */
  empty?: ReactNode;
  /** Copy for `unauthorized`. A reason, not a generic "please sign in" (§9.7). */
  unauthorizedReason?: string;
  /** Action for `unauthorized`, e.g. a Sign-in CTA (D-024: signed-out views
   *  offer a way back in, never a dead end). */
  unauthorizedAction?: ReactNode;
  /** Copy for `error`, shown beside the failure statement. */
  errorDetail?: string;
  /** Retry handler for `error`. */
  onRetry?: () => void;
  /** Loading label, announced through the live region. */
  loadingLabel?: string;
}

export function AuthenticatedView<T>({
  state,
  children,
  empty,
  unauthorizedReason = "This surface belongs to a connected account.",
  unauthorizedAction,
  errorDetail,
  onRetry,
  loadingLabel = "Loading",
}: AuthenticatedViewProps<T>) {
  switch (state.status) {
    case "loading":
      return <LoadingBlock label={loadingLabel} rows={4} />;
    case "unauthorized":
      return (
        <>
          <PermissionBlock reason={unauthorizedReason} />
          {unauthorizedAction ?? null}
        </>
      );
    case "error":
      return <ErrorBlock detail={errorDetail ?? state.error} onRetry={onRetry} />;
    case "empty":
      return <>{empty ?? <EmptyBlock title="Nothing here yet" />}</>;
    case "ready":
      return <>{children(state.data)}</>;
    default:
      // Unreachable: the union is exhaustive. Rendered rather than thrown so a
      // future variant degrades to an empty surface instead of a blank page.
      return null;
  }
}