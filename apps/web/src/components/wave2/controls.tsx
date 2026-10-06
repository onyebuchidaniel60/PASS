/**
 * PASS Wave 2 — actions and form controls.
 *
 * design/DESIGN.md §9.3 and §9.4.
 *
 * Rules encoded here rather than merely followed, because each is easy to break
 * by accident and each has a test:
 *
 *  - §2.5 The accent fills only the PRIMARY action. Destructive uses the
 *    data-negative TEXT colour, not a second saturated fill.
 *  - §7.1 An icon-only control keeps the full 44px hit area regardless of the
 *    glyph's optical size, and must carry an accessible name.
 *  - §2.8 Validation is text plus aria-live, never border colour alone.
 *  - §6.5 Press feedback is defined once in CSS and inherited by every variant,
 *    rather than re-authored per component.
 *  - §12.4 Buttons name the action. No "Submit", no "Continue" where a better
 *    verb exists — the label is a prop with no safe default beyond "Submit",
 *    which is why there is no default at all.
 */
import { useId, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  /**
   * The action, named as an imperative verb (§12.4). Deliberately required with
   * no default: "Submit" is a forbidden shape and a silent default would
   * reintroduce it.
   */
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit";
  disabled?: boolean;
  /**
   * Marks the control present but unavailable and keeps it focusable, which a
   * bare `disabled` does not. DESIGN.md §10.5 requires Publish to be disabled
   * WITH AN INLINE REASON, so the reason must be announced while the control is
   * still reachable.
   */
  disabledReason?: string;
  className?: string;
  fullWidth?: boolean;
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  type = "button",
  disabled = false,
  disabledReason,
  className,
  fullWidth = false,
}: ButtonProps) {
  const id = useId();
  const inactive = disabled || Boolean(disabledReason);
  return (
    <button
      type={type}
      className={["pass-btn", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      onClick={inactive ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabledReason ? true : undefined}
      aria-describedby={disabledReason ? `${id}-reason` : undefined}
      style={fullWidth ? { width: "100%" } : undefined}
    >
      {children}
      {disabledReason ? (
        <span id={`${id}-reason`} className="pass-field-helper">
          {disabledReason}
        </span>
      ) : null}
    </button>
  );
}

export interface IconButtonProps {
  /**
   * REQUIRED. §7.3: a glyph is never the only carrier of meaning and every
   * icon-only control needs an accessible name. Not optional, so an unlabelled
   * icon button cannot compile.
   */
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/** §9.3 Icon-only, mandatory accessible name, 44px minimum target. */
export function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  className,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={["pass-icon-btn", className].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export interface LinkButtonProps {
  children: ReactNode;
  href: string;
  external?: boolean;
  className?: string;
}

/**
 * §9.3 Text link with an underline that APPEARS on hover.
 *
 * An external link gets rel="noopener noreferrer" and target="_blank"; §7.2
 * reserves arrow-up-right for external links.
 */
export function LinkButton({ children, href, external = false, className }: LinkButtonProps) {
  return (
    <a
      className={["pass-link-btn", className].filter(Boolean).join(" ")}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Required: a group of buttons needs a name for assistive technology. */
  label: string;
  className?: string;
}

/**
 * §9.3 Segmented selection. Long/Short, entry type, period.
 *
 * Uses aria-pressed per option rather than role="radio", because these are
 * toggles that apply immediately rather than a form value committed later, and
 * aria-pressed is what matches that behaviour.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={["pass-segmented", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="pass-segmented-option"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface ValidationMessageProps {
  children: ReactNode;
  /** Pass the field's error id so aria-describedby can point at it. */
  id?: string;
}

/**
 * §9.4 / §2.8 Validation message: text plus aria-live, never colour alone.
 *
 * aria-live="polite" because a validation message appearing while someone is
 * typing should not interrupt them.
 */
export function ValidationMessage({ children, id }: ValidationMessageProps) {
  return (
    <p className="pass-validation" id={id} aria-live="polite">
      <span aria-hidden="true">!</span>
      <span>{children}</span>
    </p>
  );
}

export interface FieldProps {
  label: string;
  children: (ids: { controlId: string; describedBy?: string }) => ReactNode;
  /** Announced with the control; also marks the label per §2.5. */
  required?: boolean;
  helper?: ReactNode;
  /** Present means invalid. Drives aria-invalid AND the message. */
  error?: ReactNode;
  className?: string;
}

/**
 * §9.4 Label + control + helper + error, wired through aria-describedby.
 *
 * The control is a render prop so Field OWNS the id wiring and a caller cannot
 * forget it — a missing describedby silently drops the error for screen readers
 * while the error is plainly visible on screen.
 */
export function Field({
  label,
  children,
  required = false,
  helper,
  error,
  className,
}: FieldProps) {
  const controlId = useId();
  const helperId = `${controlId}-helper`;
  const errorId = `${controlId}-error`;

  const describedBy =
    [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={["pass-field", className].filter(Boolean).join(" ")}>
      <label className="pass-field-label" htmlFor={controlId}>
        {label}
        {required ? (
          <span className="pass-field-required" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
        {required ? <span className="visually-hidden"> (required)</span> : null}
      </label>
      {children({ controlId, describedBy })}
      {helper ? (
        <span className="pass-field-helper" id={helperId}>
          {helper}
        </span>
      ) : null}
      {error ? <ValidationMessage id={errorId}>{error}</ValidationMessage> : null}
    </div>
  );
}

export interface TextInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** §9.4 Plain text input. */
export function TextInput({
  id,
  value,
  onChange,
  describedBy,
  invalid = false,
  placeholder,
  disabled = false,
  className,
}: TextInputProps) {
  return (
    <input
      id={id}
      type="text"
      className={["pass-control", className].filter(Boolean).join(" ")}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export interface NumericInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Explicit input mode, per §9.4. */
  inputMode?: "decimal" | "numeric";
  suffix?: string;
  className?: string;
}

/**
 * §9.4 / §11.1 Mono numerals with an explicit input mode.
 *
 * Accepts a STRING rather than a number on purpose: the caller's formatting and
 * the market's decimal convention are its business, and coercing to number here
 * would re-round and drop a trailing "." mid-entry (§11.2).
 */
export function NumericInput({
  id,
  value,
  onChange,
  describedBy,
  invalid = false,
  placeholder,
  disabled = false,
  inputMode = "decimal",
  suffix,
  className,
}: NumericInputProps) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        className={["pass-control", "pass-numeric", className].filter(Boolean).join(" ")}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      {suffix ? (
        <span className="pass-field-helper" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

export interface TextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

/** §9.4 Thesis input. The display clamp is applied by the caller, not here. */
export function Textarea({
  id,
  value,
  onChange,
  describedBy,
  invalid = false,
  disabled = false,
  rows = 4,
  className,
}: TextareaProps) {
  return (
    <textarea
      id={id}
      rows={rows}
      className={["pass-control", "pass-textarea", className].filter(Boolean).join(" ")}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/** §9.4 Asset, entry type, expiry. */
export function Select({
  id,
  value,
  options,
  onChange,
  describedBy,
  invalid = false,
  disabled = false,
  className,
}: SelectProps) {
  return (
    <select
      id={id}
      className={["pass-control", className].filter(Boolean).join(" ")}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export interface LeverageStepperProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  /** Bounds are SHOWN, not just enforced (§9.4). */
  min: number;
  max: number;
  step?: number;
  describedBy?: string;
  className?: string;
}

/** §9.4 Numeric stepper with permitted bounds shown. */
export function LeverageStepper({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  describedBy,
  className,
}: LeverageStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  return (
    <div className={["pass-stepper", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="pass-icon-btn"
        aria-label={`Decrease to ${Math.max(min, value - step)}`}
        disabled={atMin}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <span aria-hidden="true">-</span>
      </button>
      <span className="pass-stepper-value" id={id} aria-describedby={describedBy}>
        {value}x
      </span>
      <button
        type="button"
        className="pass-icon-btn"
        aria-label={`Increase to ${Math.min(max, value + step)}`}
        disabled={atMax}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <span aria-hidden="true">+</span>
      </button>
      <span className="pass-field-helper">
        {min}x – {max}x
      </span>
    </div>
  );
}

export interface ExpiryControlProps {
  id: string;
  /** Absolute, ISO-8601 UTC. */
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * §9.4 Absolute timestamp with a relative hint.
 *
 * Takes an ISO string and derives the relative hint here so both forms come
 * from ONE value and cannot drift apart (§9, rule 2: two definitions of the
 * same quantity disagreeing is the most under-inspected defect shape).
 */
export function ExpiryControl({
  id,
  value,
  onChange,
  describedBy,
  invalid = false,
  className,
}: ExpiryControlProps) {
  const when = new Date(value);
  const valid = !Number.isNaN(when.getTime());
  const absolute = valid
    ? `${when.toISOString().slice(0, 16).replace("T", " ")} UTC`
    : "—";
  const deltaMs = valid ? when.getTime() - Date.now() : 0;
  const hours = Math.round(deltaMs / 3_600_000);
  const relative = valid
    ? hours > 0
      ? `in ${hours}h`
      : hours < 0
        ? `${Math.abs(hours)}h ago`
        : "now"
    : "";

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <input
        id={id}
        type="datetime-local"
        className={["pass-control", className].filter(Boolean).join(" ")}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="pass-field-helper">
        {absolute}
        {relative ? ` · ${relative}` : ""}
      </span>
    </span>
  );
}

export interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  describedBy?: string;
  className?: string;
}

/** §9.4 Consent. Never pre-ticked (§10.6 Step 3). */
export function Checkbox({
  id,
  checked,
  onChange,
  label,
  describedBy,
  className,
}: CheckboxProps) {
  return (
    <label className={["pass-checkbox-row", className].filter(Boolean).join(" ")} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: "var(--space-4)", height: "var(--space-4)", accentColor: "var(--color-accent)" }}
      />
      <span className="pass-field-helper">{label}</span>
    </label>
  );
}

export interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  describedBy?: string;
  className?: string;
}

/** §9.4 Preference. Preference implies persistence, which consent does not. */
export function Toggle({ id, checked, onChange, label, describedBy, className }: ToggleProps) {
  return (
    <span
      id={id}
      className={["pass-toggle-row", className].filter(Boolean).join(" ")}
      onClick={() => onChange(!checked)}
      role="switch"
      tabIndex={0}
      aria-checked={checked}
      aria-label={typeof label === "string" ? label : undefined}
      aria-describedby={describedBy}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <span className="pass-toggle-track" aria-checked={checked} />
      <span className="pass-field-helper">{label}</span>
    </span>
  );
}
