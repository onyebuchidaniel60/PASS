/**
 * PASS Wave 1 — layout and framing primitives.
 *
 * design/DESIGN.md §9.1: PageShell, TopBar/Sidebar/BottomNav (Wave 5), Section,
 * Panel, ChamferPanel, Rule, GridField, Stack, Inline.
 *
 * Every component here is token-driven. No raw value appears in any of them, and
 * scripts/check-design-tokens.mjs fails the build if one does.
 *
 * These are presentational only. None fetches data, so the empty/loading/error
 * states required by FRONTEND_IMPLEMENTATION_PLAN.md §2.4 belong to the
 * Wave 3/4 state blocks and to the screens, not to a layout primitive. What each
 * component does owe is a documented reduced-motion path, which is a CSS
 * concern handled in styles/components.css and asserted in the tests.
 */
import type { CSSProperties, ElementType, ReactNode } from "react";

/** Spacing steps from design/DESIGN.md §4. Named, never numeric. */
export type SpaceToken =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10";

const spaceVar = (token: SpaceToken): string => `var(--space-${token})`;

export interface StackProps {
  /** Vertical gap, as a spacing token. §4: no value outside this scale. */
  gap?: SpaceToken;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** §9.1 Vertical rhythm container. `min-width: 0` so a wide child cannot force
 *  the page to overflow horizontally (§8.5). */
export function Stack({ gap = "4", children, className, style }: StackProps) {
  return (
    <div
      className={["pass-stack", className].filter(Boolean).join(" ")}
      style={{ gap: spaceVar(gap), ...style }}
    >
      {children}
    </div>
  );
}

export interface InlineProps {
  /** Inline gap, as a spacing token. */
  gap?: SpaceToken;
  /** Wraps by default: a row of chips must not force horizontal overflow. */
  wrap?: boolean;
  align?: CSSProperties["alignItems"];
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** §9.1 Horizontal grouping. */
export function Inline({
  gap = "2",
  wrap = true,
  align = "center",
  children,
  className,
  style,
}: InlineProps) {
  return (
    <div
      className={["pass-inline", className].filter(Boolean).join(" ")}
      style={{ gap: spaceVar(gap), alignItems: align, flexWrap: wrap ? "wrap" : "nowrap", ...style }}
    >
      {children}
    </div>
  );
}

export interface SectionProps {
  children: ReactNode;
  /** Renders as a landmark section. §9.1. */
  as?: ElementType;
  /**
   * Required for the section to be a landmark at all. HTML-AAM gives `<section>`
   * the `region` role only when it has an accessible name; an unnamed section
   * is generic and invisible to landmark navigation.
   */
  label?: string;
  className?: string;
}

/** §4 Sections are separated by --space-8 on mobile, --space-9 on desktop. */
export function Section({ children, as: As = "section", label, className }: SectionProps) {
  return (
    <As
      className={["pass-section", className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {children}
    </As>
  );
}

export interface PanelProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}

/** §2.2 / §5.3 A bordered --color-surface container. No radius (§5.1), no
 *  shadow (§5.4). */
export function Panel({ children, as: As = "div", className }: PanelProps) {
  return (
    <As className={["pass-panel", className].filter(Boolean).join(" ")}>{children}</As>
  );
}

export interface ChamferPanelProps {
  children: ReactNode;
  /** §5.3 Accent hairline on the TOP edge only, for the one key panel on screen. */
  accentEdge?: boolean;
  as?: ElementType;
  className?: string;
  /** Distinguishes panels that are not the single key object of a region. */
  label?: string;
}

/**
 * §5.2 The signature corner-bracket frame, for the single important object.
 *
 * Chamfered via clip-path, never rounded. Deliberately has no shadow: §5.2 says
 * the chamfer is a framing device only, and §5.4 forbids shadow elevation on a
 * non-overlay surface.
 *
 * §5.2 caps this at one panel per viewport region and three per screen. That is
 * a composition rule, enforced in the gallery and at review, not here.
 */
export function ChamferPanel({
  children,
  accentEdge = false,
  as: As = "div",
  className,
  label,
}: ChamferPanelProps) {
  return (
    <As
      className={["pass-chamfer-panel", className].filter(Boolean).join(" ")}
      data-accent-edge={accentEdge ? "true" : "false"}
      aria-label={label}
    >
      {children}
    </As>
  );
}

export interface RuleProps {
  /** Hidden from assistive technology by default: a divider carries no meaning
   *  beyond the grouping it already implies visually. */
  label?: string;
  className?: string;
}

/** §5.3 Horizontal hairline divider. */
export function Rule({ label, className }: RuleProps) {
  return (
    <hr
      className={["pass-rule", className].filter(Boolean).join(" ")}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}

export interface GridFieldProps {
  /**
   * §8.2 Background column rules are structural and permitted behind a hero
   * ONLY. This prop does not enforce that; the gallery and review do. It is
   * documented here so the misuse is traceable.
   */
  children?: ReactNode;
  className?: string;
}

/**
 * §9.1 Optional background column rules at the grid's own column positions.
 *
 * Decorative and inert: `aria-hidden`, and `pointer-events: none` in CSS, so it
 * can never intercept a click meant for the hero behind it.
 */
export function GridField({ children, className }: GridFieldProps) {
  const columns = Array.from(
    { length: 12 },
    (_, i) => i,
  );
  return (
    <div
      className={["pass-grid-field", className].filter(Boolean).join(" ")}
      aria-hidden="true"
      data-pass-columns={columns.length}
    >
      {children ??
        columns.map((i) => <span key={i} data-column={i + 1} />)}
    </div>
  );
}

export interface PageShellProps {
  children: ReactNode;
  /**
   * Wave 5 ships TopBar/Sidebar/BottomNav. This flag reserves the bottom
   * navigation's exported height plus --space-6 so the last element is never
   * occluded. It is the reserved space, and it is measured in the gallery rather
   * than assumed (DESIGN.md §8.4).
   */
  bottomNav?: boolean;
  className?: string;
}

/**
 * §8.4 Page frame and scroll ownership.
 *
 * Renders a <main> landmark so there is exactly one per page, and the shell
 * carries the dark canvas so no light gap can appear at any breakpoint
 * (§12.5).
 */
export function PageShell({ children, bottomNav = false, className }: PageShellProps) {
  return (
    <div
      className={["pass-page-shell", className].filter(Boolean).join(" ")}
      data-bottom-nav={bottomNav ? "true" : "false"}
    >
      <main>{children}</main>
    </div>
  );
}

export interface ShellContentProps {
  children: ReactNode;
  className?: string;
}

/** §8.2/§8.3 Content box, capped at 1280px and centred above that. */
export function ShellContent({ children, className }: ShellContentProps) {
  return (
    <div className={["pass-shell-content", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
