/**
 * Generates `apps/web/src/app/apple-icon.png` from the PASS mark.
 *
 * WHY THIS IS A SCRIPT AND NOT A COMMITTED BINARY HAND-DRAWN ONCE
 *
 * `app/icon.svg` is Next.js's own convention and covers the browser tab. But
 * `apple-icon` only accepts a raster format, and a committed PNG whose
 * provenance is "someone drew it once" cannot be regenerated, diffed, or
 * re-derived when §14.14 changes. A PNG produced by a committed script can be
 * re-derived on demand and reviewed as code.
 *
 * THE MARK (design/DESIGN.md §14.14)
 *
 * The same geometry as `apps/web/src/components/reference/logo.tsx` `LogoMark`,
 * with the CSS custom properties resolved to their token values because a
 * raster has no cascade to read them from:
 *
 *   - an ember radial inside a rounded square, bright core at 38%/62%;
 *   - the mark knocked out in the canvas colour: a ring crossed by the signal
 *     line, with a filled ember dot on the ring at 45 degrees.
 *
 * Written against Node's built-in `zlib` only. No image dependency is added,
 * because AGENTS.md forbids a UI framework and a rasteriser for one 180x180
 * icon is not a dependency worth taking.
 *
 * Run: node scripts/generate-pass-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(root, "apps", "web", "src", "app");

/** Token values, resolved. Kept as literals here on purpose: a rasteriser has
 *  no cascade, so these ARE the token values, not an approximation of them. */
const EMBER_BRIGHT = [0xff, 0x6b, 0x33];
const EMBER_CORE = [0xf4, 0x55, 0x2e];
const EMBER_MID = [0x7a, 0x24, 0x10];
const CANVAS = [0x0a, 0x0a, 0x0a];

const SIZE = 180;
const RADIUS = SIZE * (5.5 / 24);
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = SIZE * (5.4 / 24);
const INNER_R = SIZE * (3 / 24);
const HALO_R = SIZE * (5.4 / 24);
const HALO_W = SIZE * (1.6 / 24);
const RING_W = SIZE * (1.4 / 24);
const LINE_W = SIZE * (1.4 / 24);
const DOT_R = SIZE * (1.6 / 24);
const DOT_CX = SIZE * (14.12 / 24);
const DOT_CY = SIZE * (9.88 / 24);

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Signed distance to a rounded rectangle centred on the canvas. */
function sdRoundedRect(px, py, half, r) {
  const qx = Math.abs(px) - (half - r);
  const qy = Math.abs(py) - (half - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function emberAt(px, py) {
  // Radial gradient centred at 38%/62% of the box, radius 78%.
  const gx = SIZE * 0.38;
  const gy = SIZE * 0.62;
  const gr = SIZE * 0.78;
  const t = clamp01(Math.hypot(px - gx, py - gy) / gr);
  if (t < 0.55) {
    const u = t / 0.55;
    return [
      lerp(EMBER_BRIGHT[0], EMBER_CORE[0], u),
      lerp(EMBER_BRIGHT[1], EMBER_CORE[1], u),
      lerp(EMBER_BRIGHT[2], EMBER_CORE[2], u),
    ];
  }
  const u = (t - 0.55) / 0.45;
  return [
    lerp(EMBER_CORE[0], EMBER_MID[0], u),
    lerp(EMBER_CORE[1], EMBER_MID[1], u),
    lerp(EMBER_CORE[2], EMBER_MID[2], u),
  ];
}

/** Anti-aliased coverage of a disc of radius `r` at pixel centre (px, py). */
function discCoverage(px, py, r) {
  const d = Math.hypot(px - CX, py - CY);
  return clamp01(r - d + 0.5);
}

/** Anti-aliased coverage of a ring of radius `r` and stroke `w`. */
function ringCoverage(px, py, r, w) {
  const d = Math.abs(Math.hypot(px - CX, py - CY) - r);
  return clamp01(w / 2 - d + 0.5);
}

function over(dst, src, alpha) {
  if (alpha <= 0) return dst;
  if (alpha >= 1) return [...src];
  return [
    lerp(dst[0], src[0], alpha),
    lerp(dst[1], src[1], alpha),
    lerp(dst[2], src[2], alpha),
  ];
}

function renderPixel(px, py) {
  // Outside the rounded square: fully transparent, so the icon masks correctly
  // on a light and a dark home screen alike.
  const sd = sdRoundedRect(px - CX, py - CY, SIZE / 2, RADIUS);
  const square = clamp01(0.5 - sd);
  if (square <= 0) return [0, 0, 0, 0];

  let rgb = emberAt(px, py);

  // The knocked-out mark: a filled disc, a halo ring at 35%, an inner ring, and
  // the signal line through the middle.
  const outer = discCoverage(px, py, OUTER_R);
  rgb = over(rgb, CANVAS, outer);

  const halo = ringCoverage(px, py, HALO_R, HALO_W) * 0.35;
  rgb = over(rgb, CANVAS, halo);

  const inner = ringCoverage(px, py, INNER_R, RING_W);
  rgb = over(rgb, CANVAS, inner);

  // The signal line: horizontal, half-width LINE_W/2, full bleed.
  const line = clamp01(LINE_W / 2 - Math.abs(py - CY) + 0.5);
  rgb = over(rgb, CANVAS, line);

  // The ember dot on the ring at 45 degrees, upper right. Drawn last so the
  // signal line does not cut through it.
  const dot = clamp01(DOT_R - Math.hypot(px - DOT_CX, py - DOT_CY) + 0.5);
  rgb = over(rgb, EMBER_BRIGHT, dot);

  return [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2]), Math.round(square * 255)];
}

/* --- PNG container ------------------------------------------------------ */

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  // Filter byte 0 (None) per scanline: the image is a smooth gradient with no
  // high-frequency detail, so Paeth would cost bytes for no gain.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw[o++] = rgba[i];
      raw[o++] = rgba[i + 1];
      raw[o++] = rgba[i + 2];
      raw[o++] = rgba[i + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const rgba = new Uint8Array(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = renderPixel(x + 0.5, y + 0.5);
    const i = (y * SIZE + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, "apple-icon.png");
writeFileSync(out, encodePng(rgba, SIZE));
console.log(`wrote ${out} (${SIZE}x${SIZE} RGBA)`);
