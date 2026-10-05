/**
 * Downloads the PASS web fonts from Google Fonts and writes them to
 * apps/web/public/fonts/ for SELF-HOSTING.
 *
 * design/DESIGN.md §3.1 requires all three families to be self-hosted with no
 * runtime font CDN, and requires each listed weight to be loaded explicitly as
 * its own face (a single family name covering several weights with no matching
 * loaded face silently falls the whole type system back to a system serif, and
 * no test fails — see SKILL_FRONTEND_DESIGN.md §12, Phase 3).
 *
 * Run once. Fonts are committed to the repo; this script is not part of the
 * build. All three families are SIL Open Font License 1.1.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps", "web", "public", "fonts");
mkdirSync(outDir, { recursive: true });

// A modern UA is required or Google serves TTF instead of woff2.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Families and the exact weights design/DESIGN.md §3.1 requires. */
const FAMILIES = [
  { css: "Archivo", slug: "archivo", weights: [500, 600, 700] },
  { css: "Inter+Tight", slug: "inter-tight", weights: [400, 500, 600] },
  { css: "IBM+Plex+Mono", slug: "ibm-plex-mono", weights: [400, 500, 600] },
];

/** Latin subset only: U+0000-00FF. */
const LATIN = "U+0000-00FF";

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

/** Pulls the latin @font-face src url out of a Google Fonts CSS response. */
function latinSrc(css) {
  const blocks = css.split("@font-face").slice(1);
  for (const b of blocks) {
    if (!b.includes(LATIN)) continue;
    const m = b.match(/url\((https:[^)]+\.woff2)\)/);
    if (m) return m[1];
  }
  throw new Error(`no latin woff2 found in:\n${css.slice(0, 400)}`);
}

const faces = [];

for (const fam of FAMILIES) {
  for (const w of fam.weights) {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${fam.css}:wght@${w}&display=swap`;
    const css = await get(cssUrl);
    const src = latinSrc(css);
    const file = `${fam.slug}-${w}.woff2`;
    const bytes = await get(src, true);
    writeFileSync(join(outDir, file), bytes);
    faces.push({ family: fam.slug, weight: w, file, bytes: bytes.length });
    console.log(`${file.padEnd(26)} ${String(bytes.length).padStart(7)} bytes`);
  }
}

// Emit the @font-face block list so tokens.css can be assembled by hand and
// reviewed, rather than generated at build time.
writeFileSync(join(outDir, "MANIFEST.json"), JSON.stringify(faces, null, 2) + "\n");
console.log(`\n${faces.length} faces -> apps/web/public/fonts/`);
