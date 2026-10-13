import { decryptField, unwrapDek } from "../employer-profile/crypto.util";

export type OwnerDisplayProfile = {
  encFirstName: Buffer | null;
  encLastName: Buffer | null;
  profilePictureUrl: string | null;
  dekWrapped: Buffer;
};

// Decrypts just the two name fields off an EmployerProfile row - a small,
// deliberate duplication of EmployerProfileService's private decryptRow
// rather than a cross-module dependency for two fields. Never decrypts
// anything else on the row (address/phone/T.C. Kimlik No stay untouched)
// since only the name is ever meant to be public.
export function ownerDisplayFromProfile(profile: OwnerDisplayProfile | null): {
  displayUsername: string | null;
  avatarPhotoUrl: string | null;
} {
  if (!profile) return { displayUsername: null, avatarPhotoUrl: null };
  const dek = unwrapDek(profile.dekWrapped);
  const first = profile.encFirstName ? decryptField(profile.encFirstName, dek) : null;
  const last = profile.encLastName ? decryptField(profile.encLastName, dek) : null;
  const displayUsername = [first, last].filter(Boolean).join(" ") || null;
  return { displayUsername, avatarPhotoUrl: profile.profilePictureUrl };
}
