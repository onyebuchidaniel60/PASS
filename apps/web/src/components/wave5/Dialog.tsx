/**
 * PASS Dialog and the §10.7 stale-Pass interstitial.
 *
 * DESIGN.md §9.8 and §5.4: overlays use the overlay TIER only — scrim backdrop,
 * --color-surface-raised, --color-line-strong border, and the single
 * --shadow-overlay token, which appears nowhere else in the codebase.
 *
 * §9.8 also requires focus to be trapped and restored on close, Escape to close,
 * and the background to be inert. Those are asserted in the test rather than
 * asserted in a comment, because an overlay that does not trap focus is the
 * defect a screen reader user hits first.
 */
import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Rendered in the overlay tier's accent position, bottom-right (§10.6). */
  action?: ReactNode;
  labelledBy?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, children, action }: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      // Focus trap: cycle within the panel so Tab cannot reach the page behind.
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    // Move focus into the dialog so the first Tab lands inside it.
    const panel = panelRef.current;
    if (panel) {
      const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      (items[0] ?? panel).focus();
    }
    return () => {
      // §9.8 restore focus on close.
      returnFocusTo.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pass-scrim"
      onKeyDown={onKeyDown}
      data-pass-overlay="dialog"
    >
      <div
        ref={panelRef}
        className="pass-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 className="pass-dialog-title" id={titleId}>
          {title}
        </h2>
        <div className="pass-dialog-body">{children}</div>
        {action ? <div className="pass-dialog-action">{action}</div> : null}
      </div>
    </div>
  );
}

export interface StaleInterstitialProps {
  open: boolean;
  onReviewLatest: () => void;
  onDismiss: () => void;
  /** The supplied copy from UX_SPEC §9, verbatim. */
  detail?: string;
  /** Mono diff of what changed, when the API can supply it. */
  changes?: { label: string; from: string; to: string }[];
}

/**
 * §10.7 / UX_SPEC §9. Replaces the page when the reviewed parameters are no
 * longer current. Execution is never silently attempted on stale parameters.
 *
 * `Review latest Pass` is the only accent on the screen (§10.7 item 2).
 */
export function StaleInterstitial({
  open,
  onReviewLatest,
  onDismiss,
  detail = "The trade parameters you reviewed are no longer current.",
  changes,
}: StaleInterstitialProps) {
  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      title="This Pass changed."
      action={
        <button
          type="button"
          className="pass-btn"
          data-variant="primary"
          data-size="md"
          onClick={onReviewLatest}
        >
          Review latest Pass
        </button>
      }
    >
      <p style={{ maxWidth: "var(--measure-body)" }}>{detail}</p>
      {changes && changes.length > 0 ? (
        <table className="pass-data-table" style={{ marginBlockStart: "var(--space-4)" }}>
          <caption className="visually-hidden">Parameters that changed</caption>
          <thead>
            <tr>
              <th scope="col">Parameter</th>
              <th scope="col">Reviewed</th>
              <th scope="col">Latest</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.label}>
                <th scope="row">{c.label}</th>
                <td className="pass-value">{c.from}</td>
                <td className="pass-value">{c.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Dialog>
  );
}
