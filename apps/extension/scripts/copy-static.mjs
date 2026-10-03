/**
 * Copies the MV3 static files into dist after the Vite bundle.
 * Vite only emits the JavaScript entries.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "src");
const dist = join(root, "dist");

mkdirSync(dist, { recursive: true });

for (const file of ["manifest.json", "content.css", "popup.html"]) {
  copyFileSync(join(src, file), join(dist, file));
  console.log(`copied ${file} -> dist/${file}`);
}