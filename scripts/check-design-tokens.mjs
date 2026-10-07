/**
 * PASS design-token scan.
 *
 * Enforces design/DESIGN.md §2.1, §3.4, §4, §5.1, §6.2–§6.3 mechanically:
 * no colour, spacing, radius, type-size, line-height, letter-spacing, duration,
 * easing, or font-family literal may appear anywhere except the token layer.
 *
 * Rejections (design/FRONTEND_IMPLEMENTATION_PLAN.md §2.2):
 *   1. raw hex literals            (#RGB, #RRGGBB, #RRGGBBAA)
 *   2. raw rgb()/rgba()/hsl()/hsla() colour literals
 *   3. px values matching a spacing, radius, type-size, line-height,
 *      letter-spacing, duration, or easing token's scale
 *   4. ms / s duration literals
 *   5. a direct import of the animation library from a component file
 *   6. font-family literals
 *
 * Per §2.3 a scan that has never failed is not known to work. This script's
 * first clean result is not trusted until a violation has been planted and
 * reported; see design/phase-records/PHASE_00_tokens.md for that evidence.
 *
 * The exclusion list is printed on EVERY run, because a silent blind spot is
 * indistinguishable from a clean file (SKILL_FRONTEND_DESIGN.md §7.5).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(root, "apps", "web", "src");

/**
 * The token layer itself, plus files whose whole purpose is raw values. Every
 * entry carries a reason and is printed on every run.
 */
const EXCLUSIONS = [
  { path: "apps/web/src/styles/tokens.css", reason: "The token layer. This is the single source of truth (plan §2.1, design gap G-14)." },
  { path: "apps/web/src/motion/index.ts", reason: "The motion helper module. Plan §2.2 check 4 permits duration literals here and nowhere else, because animation behaviour lives here and nowhere else." },
  { path: "scripts/check-design-tokens.mjs", reason: "This scanner. Its patterns necessarily contain the literals it looks for." },
  { path: "scripts/check-contrast.mjs", reason: "Contrast checker. Carries documented design/doc ratio figures as data." },
];

/** Files never scanned at all (generated, vendored, or binary). */
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".vercel", ".git", "fonts"]);
const SCAN_EXT = new Set([".ts", ".tsx", ".css", ".scss"]);

const RULES = [
  {
    id: "hex-literal",
    clause: "DESIGN.md §2.1",
    re: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    // #ids in urls/fragments and CSS ids would false-positive; require the hex
    // to look like a colour by demanding it is not part of a longer word.
    filter: (m, line) => !/#[0-9a-zA-Z_-]*[g-zG-Z]/.test(line.slice(m.index, m.index + m[0].length)),
    label: "raw hex colour literal",
  },
  {
    id: "fn-colour-literal",
    clause: "DESIGN.md §2.1",
    re: /\b(?:rgba?|hsla?)\s*\(/g,
    label: "raw rgb()/rgba()/hsl()/hsla() colour literal",
  },
  {
    id: "font-family-literal",
    clause: "DESIGN.md §3.1",
    re: /font-family\s*:/g,
    // `font-family: var(--font-data)` is exactly the required token usage.
    // Only a literal family (quoted string or bare name) is a violation.
    filter: (m, line) => {
      const value = line.slice(m.index + m[0].length).trim();
      // `var(--font-data)` is exactly the required token usage.
      if (value.includes("var(")) return false;
      // CSS-wide keywords name no family.
      if (/^(inherit|initial|unset|revert|revert-layer)\s*;?$/.test(value)) return false;
      // A declaration with no value on this line (multi-line) is not provably
      // a literal; leave it to the hex/px rules rather than guess.
      return value.length > 0;
    },
    label: "font-family literal outside the token layer (use var(--font-*))",
  },
  {
    id: "duration-literal",
    clause: "DESIGN.md §6.2",
    re: /\b\d+(?:\.\d+)?m?s\b/g,
    // Only duration-bearing properties; `0s` in a data string is not a duration.
    filter: (m, line) => /transition|animation|duration|delay|ease|timing/i.test(line),
    label: "raw ms/s duration literal",
  },
  {
    id: "px-literal",
    clause: "DESIGN.md §4, §5.1, §3.3",
    re: /\b\d+(?:\.\d+)?px\b/g,
    filter: (m, line) => {
      // Media query breakpoints are NOT spacing, radius, or type values.
      // DESIGN.md §8.1 defines them as breakpoint ranges, and CSS custom
      // properties cannot be used in a media query condition, so a breakpoint
      // genuinely cannot be a token. The four values are recorded in
      // tokens.css next to --layout-* so they still have one source.
      if (/@media/.test(line) && /(?:min|max)-width:\s*\d+px/.test(line)) return false;
      return true;
    },
    label: "raw px value (spacing/radius/type scale is token-only)",
  },
  {
    id: "animation-library-import",
    clause: "FRONTEND_IMPLEMENTATION_PLAN.md §5",
    re: /from\s+["'](?:framer-motion|gsap|@react-spring|popmotion|animejs|velocity-animate)["']/g,
    label: "direct animation-library import; use a motion helper instead",
  },
  {
    id: "font-family-literal-js",
    clause: "DESIGN.md §3.1",
    // The CSS rule above cannot see a React style object, where the property is
    // camelCase. Without this, `fontFamily: "Comic Sans MS"` passes silently.
    re: /fontFamily\s*:/g,
    filter: (m, line) => {
      const value = line.slice(m.index + m[0].length).trim();
      if (value.includes("var(")) return false;
      return value.length > 0;
    },
    label: "font-family literal in a React style object (use a token class)",
  },
  {
    id: "inline-style-object",
    clause: "FRONTEND_IMPLEMENTATION_PLAN.md §2.2",
    // A unitless number in a React style object is a px value, so neither the
    // hex rule nor the px rule can see it. Rather than guess at which numeric
    // properties are lengths, reject an inline style object whose values are
    // NOT token references. `var(--space-7)` is the required form; `padding: 13`
    // is the defect.
    re: /style=\{\{/g,
    onlyIn: "components",
    filter: (m, line) => {
      const obj = line.slice(m.index + m[0].length);
      // A value that is a bare number (with any unit or none) is a literal.
      if (/:\s*-?\d+(\.\d+)?\s*(px|rem|em|%)?\s*[,}]/.test(obj)) return true;
      // A colour literal in any form.
      if (/#[0-9a-fA-F]{3,8}\b/.test(obj) || /\b(?:rgba?|hsla?)\s*\(/.test(obj)) return true;
      // Everything else is token-backed or a keyword, which is allowed.
      return false;
    },
    label: "React inline style object with a literal value; use a token-backed class or var(--token)",
  },
];

/**
 * A ratchet, not a blanket exclusion.
 *
 * Wave 7 rebuilds each screen against the token layer. Until a screen is
 * rebuilt its provisional values are still present, and `pnpm check` has to
 * stay runnable. Each entry names the file, the EXACT number of violations
 * still tolerated there, and why. Any additional violation in that file fails,
 * and removing the last one fails too — so the entry cannot rot.
 *
 * Removing an entry is part of rebuilding the screen it names.
 *
 * EMPTY as of 2026-10-07 (Stage K): all four Wave 7 screen rebuilds landed and
 * each of these files is back to zero violations, so every entry has been
 * deleted. The map stays in the file because a later screen may need a
 * provisional allowance, and an entry added for a file that is already clean
 * is a silent hole — check the printed allowance against the printed findings.
 */
const PENDING_MIGRATION = {};

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (SCAN_EXT.has(extname(entry))) yield full;
  }
}

const excludedAbs = new Set(EXCLUSIONS.map((e) => join(root, e.path)));

const findings = [];
let scanned = 0;

for (const file of walk(WEB)) {
  if (excludedAbs.has(file)) continue;
  const rel = relative(root, file).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  scanned++;

  // Track multi-line /* ... */ state. Checking only whether a line STARTS with
  // a comment marker is not enough: a continuation line inside a block comment
  // can legitimately mention "0ms" or a hex, and before this was tracked, such
  // a line was scanned as if it were code. That is a false positive here and a
  // false negative the moment a real violation sits after a block comment.
  let inBlockComment = false;

  for (const rule of RULES) {
    const lines = src.split(/\r?\n/);
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (inBlockComment) {
        if (trimmed.includes("*/")) inBlockComment = false;
        return;
      }
      if (trimmed.startsWith("//")) return;
      if (trimmed.startsWith("/*")) {
        if (!trimmed.includes("*/")) inBlockComment = true;
        return;
      }
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        if (rule.onlyIn && !rel.startsWith(`apps/web/src/${rule.onlyIn}/`)) continue;
        if (rule.filter && !rule.filter(m, line)) continue;
        findings.push({ rel, line: i + 1, rule, value: m[0].trim() });
      }
    });
  }
}

console.log("PASS design-token scan (scripts/check-design-tokens.mjs)\n");
console.log("EXCLUSIONS — printed on every run so no blind spot is silent:");
for (const e of EXCLUSIONS) console.log(`  - ${e.path}\n      ${e.reason}`);
console.log("");
console.log("PENDING MIGRATION (Wave 7 screen rebuilds) — exact counts, ratcheted:");
for (const [file, v] of Object.entries(PENDING_MIGRATION)) {
  console.log(`  - ${file}  tolerating ${v.expected} violation(s)`);
  console.log(`      ${v.why}`);
}
console.log("");
console.log(`scanned ${scanned} file(s) under apps/web/src`);
console.log(`rules: ${RULES.map((r) => r.id).join(", ")}\n`);

// Apply the ratchet per file. A file over its allowance fails; a file under it
// also fails, because that means the entry is stale and must be deleted.
const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.rel)) byFile.set(f.rel, []);
  byFile.get(f.rel).push(f);
}

const ratchetErrors = [];
for (const [rel, list] of byFile) {
  const allowance = PENDING_MIGRATION[rel];
  if (!allowance) continue;
  if (list.length > allowance.expected) {
    ratchetErrors.push(`${rel}: ${list.length} violations, allowance is ${allowance.expected}`);
  } else if (list.length < allowance.expected) {
    ratchetErrors.push(
      `${rel}: ${list.length} violations but the allowance says ${allowance.expected}. ` +
        `Delete the stale entry from PENDING_MIGRATION.`,
    );
  }
}

if (findings.length === 0 && ratchetErrors.length === 0) {
  console.log("clean: no out-of-token values found.");
  process.exit(0);
}

console.log(`${findings.length} VIOLATION(S):\n`);
let untolerated = 0;
for (const f of findings) {
  const allowance = PENDING_MIGRATION[f.rel];
  const tolerated = allowance && byFile.get(f.rel).length <= allowance.expected;
  if (!tolerated) untolerated++;
  console.log(
    `  ${tolerated ? "TOLERATED" : "VIOLATION"}  ${f.rel}:${f.line}  [${f.rule.id}] ${f.rule.clause}`,
  );
  console.log(`      ${f.rule.label}: ${f.value}`);
  if (tolerated) console.log(`      pending Wave 7 migration — see PENDING_MIGRATION`);
}
if (ratchetErrors.length) {
  console.log("\nRATCHET ERRORS:");
  for (const e of ratchetErrors) console.log(`  - ${e}`);
}
console.log(
  "\nEvery value above belongs in apps/web/src/styles/tokens.css. Add the token there first",
);
console.log("(plan §2.2), then use it. Never inline a value 'just this once'.");

if (untolerated === 0 && ratchetErrors.length === 0) {
  console.log(
    `\nresult: every remaining value is a recorded Wave 7 migration, not a new violation. PASS.`,
  );
  process.exit(0);
}
console.log(`\nresult: ${untolerated} untolerated violation(s), ${ratchetErrors.length} ratchet error(s). FAIL.`);
process.exit(1);
