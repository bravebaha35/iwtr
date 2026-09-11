// Single source of truth for "is this a real deployment" — every
// production-only safety gate in this API (this file's requireSecret,
// the dev-only admin/owner login shortcuts in AuthService, and the
// console-based SMS/email/OTP fallbacks that fake-send instead of
// delivering for real) calls this instead of checking NODE_ENV directly.
//
// Deliberately fails toward "yes, this is production" for anything that
// isn't explicitly a recognized local/test value, rather than only for
// the exact string "production" — plain `node dist/main.js` does NOT set
// NODE_ENV by itself (that's a common misconception), and this repo has
// no Dockerfile/Procfile/deploy script yet that would set it either. An
// unset or misconfigured NODE_ENV on a real deployment must lock every one
// of these down, never fall through to an insecure default. Local dev sets
// NODE_ENV=development explicitly (see .env.example) specifically so this
// stays open there.
export function isProductionEnv(): boolean {
  const env = process.env.NODE_ENV;
  return env !== "development" && env !== "test";
}

// Central place to read security-critical secrets. Every one of these controls
// something that would be catastrophic if it silently fell back to a guessable
// default in a real deployment (JWT signing, PII encryption, the TCKN hash
// pepper) — see CLAUDE.md's "standing risk" note on the PII vault boundary.
//
// Refuses to boot with a missing/placeholder value once isProductionEnv() is
// true. Locally (NODE_ENV=development), a missing value still works so
// `pnpm dev` isn't blocked by this, but it prints a loud warning so it's
// never silent.
export function requireSecret(envVarName: string, devPlaceholder: string): string {
  const value = process.env[envVarName];
  const isProduction = isProductionEnv();

  if (value && value !== devPlaceholder) {
    return value;
  }

  if (isProduction) {
    throw new Error(
      `${envVarName} is not set (or is still the development placeholder value). ` +
        "Refusing to start with NODE_ENV=production like this — set a real secret.",
    );
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[iwtr] WARNING: ${envVarName} is not set to a real value — using an insecure development-only ` +
      "placeholder. This is only acceptable for local development; it will refuse to boot in production.",
  );
  return devPlaceholder;
}
