import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * DOM test harness for the PASS web app.
 *
 * The root vitest.config.ts covers packages/** and apps/api/** under a node
 * environment, so it cannot run a React component test at all. This config is
 * separate rather than a workspace project because the two need different
 * environments and different JSX handling; a single file cannot serve both
 * without conditionals that would hide which mode a given test ran in.
 *
 * Authorized as a verification tool. No UI framework, component library, or
 * animation library is installed (design/FRONTEND_IMPLEMENTATION_PLAN.md §2.4
 * requires a test per component; that is what this exists to support).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@pass/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "@pass/ui": path.resolve(__dirname, "../../packages/ui/src/index.tsx"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    css: false,
    restoreMocks: true,
  },
});
