// Central place to read security-critical secrets. Every one of these controls
// something that would be catastrophic if it silently fell back to a guessable
// default in a real deployment (JWT signing, PII encryption, the TCKN hash
// pepper) — see CLAUDE.md's "standing risk" note on the PII vault boundary.
//
// We refuse to boot with a missing/placeholder value once NODE_ENV=production
// (set automatically by virtually every hosting platform, and by convention
// for `node dist/main.js`). Locally, a missing value still works so `pnpm dev`
// isn't blocked by this, but it prints a loud warning so it's never silent.
export function requireSecret(envVarName: string, devPlaceholder: string): string {
  const value = process.env[envVarName];
  const isProduction = process.env.NODE_ENV === "production";

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
