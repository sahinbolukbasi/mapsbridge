import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (applied to .ts/.tsx files)
  ...tseslint.configs.recommended,

  // Prettier compatibility — disables formatting rules that conflict
  prettierConfig,

  // Global ignore patterns
  {
    ignores: [
      "node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/.build/**",
      "**/*.cjs",
      "**/*.js",
    ],
  },

  // Rules for TypeScript source files across the monorepo
  {
    files: [
      "apps/**/*.ts",
      "apps/**/*.tsx",
      "packages/**/*.ts",
      "packages/**/*.tsx",
      "services/**/*.ts",
      "services/**/*.tsx",
      "infra/lambda/src/**/*.ts",
    ],
    rules: {
      // 384 existing violations — warn for now, not error
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "no-console": "warn",
    },
  },
);
