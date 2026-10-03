import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/api/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@pass/contracts": path.resolve(__dirname, "packages/contracts/src/index.ts"),
      "@pass/domain": path.resolve(__dirname, "packages/domain/src/index.ts"),
      "@pass/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@pass/integrations": path.resolve(
        __dirname,
        "packages/integrations/src/index.ts",
      ),
    },
  },
});