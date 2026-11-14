/**
 * The PASS mark — design/DESIGN.md §14.14.
 *
 * `PASS` set in the display face, all caps, with two ember elements:
 *
 *   1. a signal line at the wordmark's optical mid-height (§9.2 SignalLine),
 *      running the full width and overshooting the final S by 6 units each side;
 *   2. a reticle inside the P's counter (§9.2 Reticle) — a ring crossed by that
 *      same line, with a filled dot on the ring's upper right at 45 degrees.
 *
 * WHY THE P. The reference set puts its ring-and-dot in the one letter with a
 * round counter, its O. Of PASS's four letters only the P has a round counter:
 * the A's is triangular and a circle does not sit in it, and the S has no
 * counter at all, so a reticle there collides with both terminals. §14.14 also
 * forbids copying the reference's mark, and the P-counter reticle is PASS's own
 * §9.2 language rather than the reference's orbit.
 *
 * WHY IT DEGRADES. At the favicon size the ring stroke thins and the reticle
 * crosshair is dropped, leaving `PASS` struck through by the signal line — still
 * the mark, still legible. That matters for a browser tab.
 *
 * WHY NO FALLBACKS IN THE `var()` CALLS. Every colour here is a bare
 * `var(--token)` with no literal fallback. The app always loads
 * `styles/tokens.css`, so a fallback would be unreachable code that the token
 * scan would rightly reject. The raster in `app/icon.svg` and
 * `scripts/generate-pass-icons.mjs` does carry resolved values, with the reason
 * recorded there: a file rendered outside the document has no cascade to read
 * them from.
 *
 * Every geometry number below is in the viewBox's own units. Nothing here is a
 * font: the wordmark is drawn as paths so the mark is identical on a machine
 * with no webfont, in an email client, and in a browser tab. The letters are
 * drawn in a heavy grotesque with the proportions of the display face; they are
 * NOT Archivo outlines, and §14.0 records why the typeface is substituted.
 */

export interface LogoProps {
  /** Rendered height in px. Width follows the viewBox aspect. */
  size?: number;
  className?: string;
  /**
   * The accessible name. `null` renders the mark as decorative, which is correct
   * when an adjacent text label already says "PASS" — two announcements of the
   * same word is noise.
   */
  title?: string | null;
}

const VIEW = { w: 132, h: 32 };

/**
 * The four letters, as filled paths on a 132x32 grid.
 *
 * Cap height 22 units, baseline at y=26, so the optical mid-height of the
 * capital band is y=15 — which is where the signal line runs.
 */
function WordmarkPaths() {
  return (
    <>
      {/* P — stem, bowl, and the counter left open for the reticle. */}
      <path d="M4 26V6h11.5a7 7 0 0 1 0 14H9.5v6Zm5.5-11h5.4a2.4 2.4 0 0 0 0-4.8H9.5Z" />
      {/* A */}
      <path d="M24.5 26 32 6h5.2l7.5 20h-5.3l-1.3-3.7h-6.9L29.9 26Zm6.3-8.2h4.4L33 12.9Z" />
      {/* S */}
      <path d="M66.8 20.4 63 17.6a6.6 6.6 0 0 1-4 1.3c-1.6 0-2.5-.6-2.5-1.6 0-1.1 1-1.6 3.3-2.1l2.5-.6c4.3-1 6.6-2.9 6.6-6.2 0-4.1-3.5-6.7-9.4-6.7-4 0-7.4 1.2-9.7 3.5l3.4 3.2a9.3 9.3 0 0 1 6.4-2.4c1.9 0 2.9.7 2.9 1.8 0 1-1 1.5-3.2 2l-2.6.6c-4.5 1-6.9 3-6.9 6.4 0 4.2 3.6 6.9 9.7 6.9 4.3 0 7.8-1.3 10.2-3.9Z" />
      {/* S — second, identical geometry, offset. */}
      <path d="M93.8 20.4 90 17.6a6.6 6.6 0 0 1-4 1.3c-1.6 0-2.5-.6-2.5-1.6 0-1.1 1-1.6 3.3-2.1l2.5-.6c4.3-1 6.6-2.9 6.6-6.2 0-4.1-3.5-6.7-9.4-6.7-4 0-7.4 1.2-9.7 3.5l3.4 3.2a9.3 9.3 0 0 1 6.4-2.4c1.9 0 2.9.7 2.9 1.8 0 1-1 1.5-3.2 2l-2.6.6c-4.5 1-6.9 3-6.9 6.4 0 4.2 3.6 6.9 9.7 6.9 4.3 0 7.8-1.3 10.2-3.9Z" />
    </>
  );
}

/** The reticle in the P's counter, plus the dot on its ring. */
function Reticle({ detailed }: { detailed: boolean }) {
  // Counter centre sits at x=13.4, y=15 in the P's own coordinates; the ring is
  // sized to clear the counter walls by 2 units on every side.
  const cx = 13.4;
  const cy = 15;
  const r = detailed ? 3.5 : 3;
  const dot = detailed ? 1.4 : 1.1;

  return (
    <g className="pass-logo-reticle">
      {/* The ring, filled with the canvas so it reads as a ring and not as a
          filled dot at the smallest sizes. */}
      <circle cx={cx} cy={cy} r={r} fill="var(--color-canvas)" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={detailed ? 1.4 : 1.2}
      />
      {detailed ? (
        <>
          {/* The crosshair, dropped below the detailed threshold: it does not
              survive the raster at favicon size. */}
          <path
            d={`M${cx - r - 1.6} ${cy}h${(r + 1.6) * 2}M${cx} ${cy - r - 1.6}v${(r + 1.6) * 2}`}
            stroke="var(--color-accent)"
            strokeWidth={0.8}
            opacity={0.75}
          />
        </>
      ) : null}
      {/* The dot, on the ring at 45 degrees, upper right. */}
      <circle
        cx={cx + r * 0.7071}
        cy={cy - r * 0.7071}
        r={dot}
        fill="var(--color-accent)"
      />
    </g>
  );
}

export function LogoMark({ size = 24, className, title = null }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title ?? undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {/* The app-icon treatment from reference image 11: an ember radial inside a
          rounded square, with the mark knocked out in the page colour. */}
      <defs>
        <radialGradient id="pass-mark-wash" cx="38%" cy="62%" r="78%">
          <stop offset="0%" stopColor="var(--color-ember-bright)" />
          <stop offset="55%" stopColor="var(--color-canvas-gradient-core)" />
          <stop offset="100%" stopColor="var(--color-canvas-gradient-mid)" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="5.5" fill="url(#pass-mark-wash)" />
      {/* The mark: a P-counter reticle, in the page colour. */}
      <circle cx="12" cy="12" r="5.4" fill="var(--color-canvas)" />
      <circle
        cx="12"
        cy="12"
        r="5.4"
        fill="none"
        stroke="var(--color-canvas)"
        strokeWidth={1.6}
        opacity={0.35}
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="var(--color-canvas)" strokeWidth={1.4} />
      <path d="M0 12h24" stroke="var(--color-canvas)" strokeWidth={1.4} />
      <circle cx="14.12" cy="9.88" r="1.6" fill="var(--color-ember-bright)" />
    </svg>
  );
}

export function Logo({ size = 40, className, title = "PASS" }: LogoProps) {
  const detailed = size >= 32;
  const width = Math.round((size * VIEW.w) / VIEW.h);

  return (
    <svg
      className={className}
      width={width}
      height={size}
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title ?? undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <g fill="var(--color-text-primary)">
        <WordmarkPaths />
      </g>
      {/* The signal line: full width, overshooting the final S by 6 units each
          side, at the optical mid-height of the capital band. */}
      <path
        d={`M0 15h${VIEW.w}`}
        stroke="var(--color-accent)"
        strokeWidth={detailed ? 1.5 : 1.8}
      />
      <Reticle detailed={detailed} />
    </svg>
  );
}
