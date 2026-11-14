import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brand sync: the browser-tab mark and the app mark are one drawing.
 * LogoMark renders a rounded-square ember field with the reticle knocked out;
 * app/icon.svg carries that exact geometry with resolved token values because
 * a favicon is rasterised outside the document cascade.
 */
describe("logo and favicon sync", () => {
  const root = resolve(__dirname, "..");
  const icon = readFileSync(resolve(root, "app/icon.svg"), "utf8");

  it("the favicon carries the LogoMark geometry", () => {
    expect(icon).toContain('<rect width="24" height="24" rx="5.5"');
    expect(icon).toContain('cx="12" cy="12" r="5.4"');
    expect(icon).toContain('cx="12" cy="12" r="3"');
    expect(icon).toContain('cx="14.12" cy="9.88" r="1.6"');
    expect(icon).toContain('<path d="M0 12h24"');
  });

  it("the Apple touch icon is a 180x180 raster of the same mark", () => {
    const png = readFileSync(resolve(root, "app/apple-icon.png"));
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    // PNG IHDR: width at byte 16, height at byte 20 (big-endian).
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});
