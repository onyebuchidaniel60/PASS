/**
 * Copies the MV3 static files into dist after the Vite bundle.
 * Vite only emits the JavaScript entries.
 *
 * WHY EACH COPY IS STAMPED WITH THE BUILD TIME
 *
 * `fs.copyFileSync` goes through `CopyFileEx` on Windows, which PRESERVES the
 * source file's mtime. That produced a genuinely misleading diagnostic: after a
 * build, `dist/content.js` carried the build timestamp while `dist/content.css`
 * still carried the timestamp of the last time that SOURCE file was edited. A
 * reader checking "is dist newer than the last commit?" — the exact check used
 * when an operator reports that the extension did not change — concludes the
 * stylesheet is stale when it is in fact current. Every copied file is therefore
 * restamped so one `ls` on dist tells the truth.
 */
import { copyFileSync, mkdirSync, utimesSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "src");
const dist = join(root, "dist");

mkdirSync(dist, { recursive: true });

const now = new Date();

for (const file of ["manifest.json", "content.css", "popup.html"]) {
  const to = join(dist, file);
  copyFileSync(join(src, file), to);
  // Overwrite the preserved source mtime with the build time.
  utimesSync(to, now, now);
  console.log(`copied ${file} -> dist/${file} @ ${now.toISOString()}`);
}
