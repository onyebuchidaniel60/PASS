import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Chrome MV3 extension build (docs/EXTENSION_SPEC.md).
 * All executable code is bundled locally; no remote code is loaded
 * (docs/INTEGRATION_VERIFICATION.md §14).
 */
export default defineConfig(({ mode }) => ({
  // `.env.production` must be loaded when building for production so the
  // bundle targets the live API and web app. Vite only auto-loads
  // `.env.production` for mode === "production", so pin the mode explicitly.
  mode: mode === "development" ? "development" : "production",
  envDir: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
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