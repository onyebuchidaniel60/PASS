import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Content-script build pass (docs/EXTENSION_SPEC.md).
 *
 * MV3 content scripts are CLASSIC scripts, not ES modules. Chrome rejects a
 * content script containing `import` at parse time, which means the script
 * never registers a listener at all: no [PASS] logs, and the popup reports
 * "Receiving end does not exist".
 *
 * The single combined build in vite.config.ts emitted `es` format, so
 * src/content.ts's `import { profileUrl } from "./config.js"` was hoisted into
 * a shared chunk and dist/content.js began with:
 *
 *   import{p as h}from"./chunks/config.js";
 *
 * This pass builds content.ts alone as a self-contained IIFE with every
 * import inlined and no chunk emission, so dist/content.js is one file with no
 * module syntax. popup/background are ES modules loaded via <script type=
 * "module"> and legitimately keep `es` format in vite.config.ts.
 *
 * Runs FIRST and empties dist; the popup/background pass then adds to it with
 * emptyOutDir: false so it does not delete content.js.
 */
export default defineConfig(({ mode }) => ({
  // Pin production so `.env.production` supplies the live API/web URLs.
  mode: mode === "development" ? "development" : "production",
  envDir: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: resolve(__dirname, "src/content.ts"),
      output: {
        entryFileNames: "content.js",
        format: "iife",
        // Required by Rollup for iife output: forces all imports to be
        // inlined rather than split into a chunk.
        inlineDynamicImports: true,
      },
    },
  },
}));
