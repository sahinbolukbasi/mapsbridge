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
      ".worktrees/**",
      ".agents/**",
      "**/.worktrees/**",
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
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-empty": ["warn", { "allowEmptyCatch": true }],
      "no-useless-assignment": "warn",
      "no-useless-catch": "warn",
      "no-useless-escape": "warn",
      "prefer-const": "warn",
      "preserve-caught-error": "off",
    },
  },

  // Server-side code uses console for logging — CloudWatch / Node runtime.
  {
    files: [
      "infra/lambda/src/**/*.ts",
      "apps/web/server/**/*.ts",
      "apps/web/app/lib/ai/**/*.ts",
      "apps/web/app/lib/visa/**/*.ts",
      "services/**/*.ts",
      "agents/**/*.ts",
      "monitoring/**/*.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },

  // Lazy-loaded require() with type assertions — intentional for cold-start optimization.
  {
    files: ["services/place-intelligence/src/infrastructure/place-store.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Tasarım sistemi (design §10, guard G5'in editör içi erken uyarısı): header/footer yalnızca
  // SiteChrome'dan (components/ui/site-chrome.tsx) render edilir; tw-utils.css yeni import edilmez.
  // root layout.tsx tw-utils.css'i import eden tek legacy global'dir (C18'de dosya silinir), bu
  // yüzden onun bloğunda yalnızca header/footer yasağı vardır.
  {
    files: ["apps/web/app/**/*.tsx"],
    ignores: ["apps/web/app/components/ui/site-chrome.tsx", "apps/web/app/layout.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/components/header-nav", "**/header-nav", "**/components/site-footer", "**/site-footer"],
              message:
                "Header/footer yalnızca SiteChrome'dan render edilir (components/ui/site-chrome.tsx; bkz. .kiro/steering/design-system.md §Chrome).",
            },
            {
              group: ["**/tw-utils.css"],
              message:
                "tw-utils.css yeni import edilmez; yerleşim sınıfı ya da primitive kullanın (bkz. .kiro/steering/design-system.md §Primitive'ler).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/app/layout.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/components/header-nav", "**/header-nav", "**/components/site-footer", "**/site-footer"],
              message:
                "Header/footer yalnızca SiteChrome'dan render edilir (components/ui/site-chrome.tsx; bkz. .kiro/steering/design-system.md §Chrome).",
            },
          ],
        },
      ],
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
