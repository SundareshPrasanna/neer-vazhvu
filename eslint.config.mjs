import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Pages and runtime modules never value-import the atlas build pipeline; its types are fine (no bundle edge).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/atlas/pipeline/**", "src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        patterns: [{
          regex: "(^|/)atlas/pipeline(/|$)|^\\./pipeline(/|$)",
          allowTypeImports: true,
          message: "src/lib/atlas/pipeline is build-time code for scripts/. Import its types only, or move the helper into src/lib/atlas.",
        }],
      }],
    },
  },
]);

export default eslintConfig;
