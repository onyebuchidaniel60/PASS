/**
 * PASS web font verification.
 *
 * design/DESIGN.md §3.1 requires all three families to be self-hosted, and
 * requires every listed weight to be loaded as its own face. Wave 0's gate
 * requires font loading to be verified BY RENDERED PIXELS. This script cannot
 * render, so it verifies everything up to the last possible step and names the
 * step it cannot reach.
 *
 * The defect class this exists to catch (SKILL_FRONTEND_DESIGN.md §12,
 * Phase 3): a family name covering several weights with no matching loaded
 * face silently falls the entire type system back to a system serif. It looks
 * like a font choice, not a bug, and NO test fails.
 *
 * Checks, all offline unless noted:
 *   1. every expected file exists, is non-zero, and starts with the woff2
 *      signature "wOF2" (a truncated file is structurally detectable);
 *   2. every @font-face in tokens.css resolves to a file that exists;
 *   3. every @font-face family and weight matches what its filename claims,
 *      so a camelCase or quoting mismatch is caught rather than silently
 *      falling back;
 *   4. no @font-face uses font-display: block, which would hide text;
 *   5. NETWORK, optional: each committed file's SHA-256 equals a freshly
 *      fetched Google Fonts latin woff2 for that same family and weight. This
 *      proves provenance — that the bytes really are that family at that
 *      weight — without adding a woff2 decoder dependency.
 *
 * Wave 0's gate is NOT closed by this script. It closes only when a human or a
 * browser-capable agent confirms the faces paint. See
 * design/phase-records/PHASE_00_tokens.md §8.3.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = join(root, "apps", "web", "public", "fonts");
const TOKENS = join(root, "apps", "web", "src", "styles", "tokens.css");

/** design/DESIGN.md §3.1: family, and the exact weights it lists. */
const EXPECTED = [
  { family: "Archivo", weights: [500, 600, 700] },
  { family: "Inter Tight", weights: [400, 500, 600] },
  { family: "IBM Plex Mono", weights: [400, 500, 600] },
];

/** Google Fonts CSS API family ids, which differ from the display names. */
const CSS_FAMILY = {
  Archivo: "Archivo",
  "Inter Tight": "Inter+Tight",
  "IBM Plex Mono": "IBM+Plex+Mono",
};

const slug = (f) => f.toLowerCase().replace(/\s+/g, "-");

/** Every face the design requires: file, family, weight. */
const FACES = EXPECTED.flatMap(({ family, weights }) =>
  weights.map((w) => ({ file: `${slug(family)}-${w}.woff2`, family, weight: w })),
);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const LATIN = "U+0000-00FF";

const errors = [];
const notes = [];

console.log("PASS web font verification (scripts/check-fonts.mjs)\n");

// --- 1. files exist, non-zero, correct signature --------------------------
console.log("1. FILE INTEGRITY");
const hashes = new Map();
for (const face of FACES) {
  const path = join(FONT_DIR, face.file);
  let buf;
  try {
    buf = readFileSync(path);
  } catch {
    errors.push(`missing file: ${face.file}`);
    console.log(`   FAIL  ${face.file} — missing`);
    continue;
  }
  if (buf.length === 0) {
    errors.push(`${face.file} is empty`);
    console.log(`   FAIL  ${face.file} — empty`);
    continue;
  }
  const sig = buf.subarray(0, 4).toString("ascii");
  if (sig !== "wOF2") {
    errors.push(`${face.file} signature is "${sig}", expected "wOF2"`);
    console.log(`   FAIL  ${face.file} — signature ${JSON.stringify(sig)}`);
    continue;
  }
  hashes.set(face.file, createHash("sha256").update(buf).digest("hex"));
  console.log(`   ok    ${face.file.padEnd(24)} ${String(buf.length).padStart(6)} bytes  wOF2`);
}

// A file in the font directory that no design token references is an
// unexplained artefact; report it rather than ignore it.
const onDisk = readdirSync(FONT_DIR).filter((f) => f.endsWith(".woff2"));
for (const f of onDisk) {
  if (!FACES.some((x) => x.file === f)) {
    notes.push(`${f} is in apps/web/public/fonts/ but no design token references it`);
  }
}

// --- 2/3/4. @font-face declarations ----------------------------------------
console.log("\n2-4. @font-face DECLARATIONS IN tokens.css");
const css = readFileSync(TOKENS, "utf8");
const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
console.log(`   ${blocks.length} @font-face block(s); ${FACES.length} face(s) required`);

if (blocks.length !== FACES.length) {
  errors.push(`tokens.css declares ${blocks.length} @font-face blocks, design requires ${FACES.length}`);
}

for (const block of blocks) {
  const family = block.match(/font-family:\s*["']?([^;"'\n]+?)["']?\s*;/)?.[1]?.trim();
  const weight = Number(block.match(/font-weight:\s*(\d+)\s*;/)?.[1]);
  const display = block.match(/font-display:\s*(\w+)\s*;/)?.[1]?.trim();
  const src = block.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
  const file = src ? src.replace(/^\/fonts\//, "") : undefined;

  if (!family || !weight || !file) {
    errors.push(`unparseable @font-face block: ${block.replace(/\s+/g, " ").trim().slice(0, 80)}`);
    continue;
  }

  const expected = FACES.find((f) => f.file === file);
  if (!expected) {
    errors.push(`${file} is referenced by an @font-face but is not a design-specified face`);
    continue;
  }
  if (expected.family !== family) {
    errors.push(`${file}: @font-face says family "${family}", filename implies "${expected.family}"`);
  }
  if (expected.weight !== weight) {
    errors.push(`${file}: @font-face says weight ${weight}, filename implies ${expected.weight}`);
  }
  if (display === "block") {
    errors.push(`${file}: font-display: block hides text on a slow load; use swap`);
  }
  console.log(`   ok    ${family} ${weight} -> ${file}  font-display:${display ?? "(unset)"}`);
}

// --- 5. optional network provenance ---------------------------------------
console.log("\n5. PROVENANCE (network, optional)");
let networkRan = false;

async function latinSrc(family, weight) {
  const url = `https://fonts.googleapis.com/css2?family=${CSS_FAMILY[family]}:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const sheet = await res.text();
  for (const b of sheet.split("@font-face").slice(1)) {
    if (!b.includes(LATIN)) continue;
    const m = b.match(/url\((https:[^)]+\.woff2)\)/);
    if (m) return m[1];
  }
  throw new Error(`no latin woff2 for ${family} ${weight}`);
}

for (const face of FACES) {
  const mine = hashes.get(face.file);
  if (!mine) continue;
  try {
    const url = await latinSrc(face.family, face.weight);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status}`);
    const theirs = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
    networkRan = true;
    if (theirs === mine) {
      console.log(`   ok    ${face.file} byte-identical to Google Fonts ${face.family} ${face.weight}`);
    } else {
      errors.push(`${face.file} does NOT match Google Fonts ${face.family} ${face.weight} — the weight may be wrong`);
      console.log(`   FAIL  ${face.file} hash differs from Google Fonts ${face.family} ${face.weight}`);
    }
  } catch (err) {
    notes.push(`provenance skipped for ${face.file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (!networkRan) {
  console.log("   SKIPPED (no network). Run with connectivity to prove provenance.");
}

// --- report ---------------------------------------------------------------
console.log("");
if (notes.length) {
  console.log("NOTES:");
  for (const n of notes) console.log(`  - ${n}`);
  console.log("");
}
if (errors.length === 0) {
  console.log(
    "result: font files, @font-face declarations, and weights are consistent.\n" +
      "        WAVE 0 FONT GATE IS STILL OPEN: this proves the files are correct,\n" +
      "        not that they paint. Confirmation requires rendered pixels — see\n" +
      "        design/phase-records/PHASE_00_tokens.md §8.3 and the operator\n" +
      "        checklist in that file.",
  );
  process.exit(0);
}
console.log(`${errors.length} FAILURE(S):`);
for (const e of errors) console.log(`  - ${e}`);
process.exit(1);
