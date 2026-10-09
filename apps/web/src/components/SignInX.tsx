"use client";

/**
 * Sign-in CTA for signed-out views (D-024). A signed-out screen is never a
 * dead end: every unauthorized branch that replaces user data offers this
 * button back into the OAuth entry (same-origin proxy, like everywhere
 * else). `onNavigate` is injectable because jsdom has no real navigation.
 */
export function SignInXButton({ onNavigate }: { onNavigate?: (url: string) => void }) {
  return (
    <button
      type="button"
      className="pass-btn"
      data-variant="primary"
      onClick={() => {
        if (onNavigate) onNavigate("/api/v1/auth/x/start");
        else if (typeof window !== "undefined") {
          window.location.assign("/api/v1/auth/x/start");
        }
      }}
    >
      Sign in with X
    </button>
  );
}

export default SignInXButton;
