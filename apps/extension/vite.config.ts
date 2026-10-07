import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Popup + background build pass (docs/EXTENSION_SPEC.md).
 * All executable code is bundled locally; no remote code is loaded
 * (docs/INTEGRATION_VERIFICATION.md §14).
 *
 * These two entries load as ES modules (manifest background.service_worker
 * type: module, popup via <script type="module">), so `es` format is correct
 * and they may share a chunk.
 *
 * The content script is deliberately NOT built here. MV3 content scripts are
 * classic scripts and cannot contain import statements, so it gets its own
 * IIFE pass in vite.config.content.ts. Run that pass first, then this one.
 */
export default defineConfig(({ mode }) => ({
  // `.env.production` must be loaded when building for production so the
  // bundle targets the live API and web app. Vite only auto-loads
  // `.env.production` for mode === "production", so pin the mode explicitly.
  mode: mode === "development" ? "development" : "production",
  envDir: ".",
  // Same stamp as the content pass, so the popup and the page console report
  // one build rather than two independently-timed ones.
  define: {
    __PASS_BUILD__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: "dist",
    // Do not wipe dist: the content-script pass already wrote content.js here.
    emptyOutDir: false,
    target: "es2022",
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        popup: resolve(__dirname, "src/popup.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]",
        format: "es",
      },
    },
  },
}));