import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".astro/**",
      ".local/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...astro.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        Blob: "readonly",
        DataTransfer: "readonly",
        DragEvent: "readonly",
        File: "readonly",
        HTMLButtonElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLLabelElement: "readonly",
        HTMLParagraphElement: "readonly",
        HTMLSpanElement: "readonly",
        HTMLTableRowElement: "readonly",
        HTMLTableSectionElement: "readonly",
        URL: "readonly",
        Worker: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        process: "readonly",
        self: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
];
