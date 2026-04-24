import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import importPlugin from "eslint-plugin-import";
import promise from "eslint-plugin-promise";
import prettier from "eslint-config-prettier";
import { fetchStandards } from "./fetch.js";

export default async function getConfig(type = 'vite') {
  const standards = await fetchStandards(type);
  const remoteRules = standards?.eslint_rules ?? {};

  return tseslint.config(
    { ignores: ["dist", ".next", "build", ".wrangler", "node_modules", "out"] },
    {
      extends: [
        js.configs.recommended,
        ...tseslint.configs.recommended,
        promise.configs["flat/recommended"],
      ],
      files: ["**/*.{ts,tsx,js,jsx}"],
      languageOptions: {
        ecmaVersion: 2022,
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.es2021,
        },
      },
      plugins: {
        "react-hooks": reactHooks,
        "react-refresh": reactRefresh,
        "simple-import-sort": simpleImportSort,
        import: importPlugin,
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        "react-hooks/exhaustive-deps": "warn",
        "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

        // --- Foundry Gold Standard Rules ---
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",
        "import/first": "error",
        "import/newline-after-import": "error",
        "import/no-duplicates": "error",
        "no-console": ["warn", { allow: ["warn", "error", "info"] }],

        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],

        // Remote rules override defaults
        ...remoteRules,
      },
    },
    prettier // This must be last to override conflicting rules
  );
}
