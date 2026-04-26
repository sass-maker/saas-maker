import simpleImportSort from "eslint-plugin-simple-import-sort";
import prettier from "eslint-config-prettier";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

let fallow = null;
try {
  fallow = (await import("@saas-maker/eslint-plugin-fallow")).default;
} catch {
  // Optional internal plugin — skip when unavailable (standalone repos).
}

export default [
  { ignores: ["dist", ".next", "build", ".wrangler", "node_modules", "out", ".open-next"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "simple-import-sort": simpleImportSort,
      ...(fallow ? { "@saas-maker/fallow": fallow } : {}),
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      ...(fallow ? { "@saas-maker/fallow/audit": "warn" } : {}),
    },
  },
  prettier,
];
