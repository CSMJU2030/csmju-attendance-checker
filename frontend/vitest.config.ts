import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Same mapping as tsconfig `paths`.
      "@csmju2030/design-system": src("design-system/index.ts"),
      "@": src(""),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
