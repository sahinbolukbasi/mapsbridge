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
    ignores: ["node_modules/**", "**/.next/**", "**/out/**", "**/.build/**", "**/*.cjs", "**/*.js"],
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
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-console": "warn",
      "no-empty": ["warn", { "allowEmptyCatch": true }],
      "no-useless-assignment": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      "preserve-caught-error": "off",
    },
  },

  // Lambda functions run server-side — console.log/error goes to CloudWatch.
  {
    files: ["infra/lambda/src/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Architectural boundary: infra/lambda must not import from apps/.
  // Shared types/utilities belong in packages/. Existing violations are warned
  // (not errored) until imports are migrated to packages/ai-runtime or similar.
  {
    files: ["infra/lambda/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["../../../../apps/**", "../../../apps/**", "../../apps/**", "../apps/**"],
              message:
                "Lambda code must not import from apps/. Move shared types to packages/ instead.",
            },
          ],
        },
      ],
    },
  },
);
