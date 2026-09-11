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
  {
    // jest.config.js is loaded directly by Node before any ESM/TS transform
    // runs, so it has to stay CommonJS (require/module.exports) - not a
    // pattern to fix, a constraint of how Jest reads its own config.
    files: ["jest.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // This codebase's consistent data-fetching idiom is "reset an
    // error/loading flag, then kick off an async request" as the first
    // lines of a useEffect body - completely standard pre-Suspense React,
    // used deliberately across ~20 components. react-hooks/set-state-in-effect
    // (new in this ESLint config generation) flags every one of those as an
    // error because calling setState synchronously in an effect can force
    // an extra render pass under the React Compiler - real for compiled
    // code, but this app doesn't use the compiler, and rewriting every
    // fetch-on-mount effect to dodge it would be a much bigger, riskier
    // change than the lint cleanup this was meant to be. Kept as a warning
    // rather than silenced entirely so genuinely new problems still surface.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
