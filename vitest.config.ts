import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        ".astro/**",
        "astro.config.mjs",
        "dist/**",
        "scripts/**",
        "src/pages/**",
        "tests/e2e/**",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
  },
});
