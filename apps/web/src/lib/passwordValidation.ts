// Frontend-only password strength rules for registration. Deliberately not
// merged into packages/shared-types' registerEmailInputSchema — that schema
// is also consumed by apps/api's ZodValidationPipe, and this is a UI-only
// gate on the "Create account" button, not a backend contract change.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRequirement {
  id: string;
  label: string;
  met: (password: string) => boolean;
}

const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /[0-9]/;
const HAS_SYMBOL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

export const LENGTH_REQUIREMENT: PasswordRequirement = {
  id: "length",
  // Only the minimum is shown to the user — the 128 cap is still enforced
  // (via `met` below and the input's maxLength) purely as a paste-DoS guard,
  // not something worth surfacing as a "requirement" to aim for.
  label: `At least ${PASSWORD_MIN_LENGTH} characters`,
  met: (p) => p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH,
};

// At least 3 of these 4 must match — not "met" individually against a fixed
// target, so isPasswordValid below counts matches rather than requiring
// every one of them.
export const CATEGORY_REQUIREMENTS: PasswordRequirement[] = [
  { id: "uppercase", label: "Uppercase letter (A-Z)", met: (p) => HAS_UPPERCASE.test(p) },
  { id: "lowercase", label: "Lowercase letter (a-z)", met: (p) => HAS_LOWERCASE.test(p) },
  { id: "number", label: "Number (0-9)", met: (p) => HAS_NUMBER.test(p) },
  { id: "symbol", label: "Special symbol (!@#$%^&*)", met: (p) => HAS_SYMBOL.test(p) },
];

export const MIN_CATEGORY_MATCHES = 3;

export function passwordCategoryCount(password: string): number {
  return CATEGORY_REQUIREMENTS.filter((req) => req.met(password)).length;
}

export function isPasswordValid(password: string): boolean {
  return LENGTH_REQUIREMENT.met(password) && passwordCategoryCount(password) >= MIN_CATEGORY_MATCHES;
}
