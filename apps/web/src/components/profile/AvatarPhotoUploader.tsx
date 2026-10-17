"use client";

import { useRef, useState } from "react";
import { validateSourceImageForAvatarCrop, type AvatarPhotoUploadResult } from "@iwtr/shared-types";
import { apiUpload, apiPatch, ApiError } from "@/lib/api-client";
import { AvatarPhotoCropper } from "@/components/profile/AvatarPhotoCropper";
import { useT } from "@/lib/i18n/client";

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Couldn't read that image."));
    };
    img.src = objectUrl;
  });
}

// Resolves once the image is in the browser's cache (or after 3 s at most -
// a slow network must never hold the upload back).
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    setTimeout(done, 3000);
    img.src = url;
  });
}

/**
 * Circular employer photo — click anywhere on it (or the pen that appears on
 * hover) to replace it. Upload path: pick -> validate -> crop+compress to a
 * JPEG client-side (AvatarPhotoCropper) -> POST the blob to get a URL back
 * -> PATCH /me/employer-profile with that URL (the PATCH endpoint already
 * accepts profilePictureUrl today, see employerProfile.ts).
 * The X in the top-right corner removes it (PATCH profilePictureUrl: null),
 * which puts the owner's chosen avatar back.
 */
export function AvatarPhotoUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilePicked(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { width, height } = await readImageDimensions(file);
      const check = validateSourceImageForAvatarCrop({ mimeType: file.type, sizeBytes: file.size, width, height });
      if (!check.valid) {
        setError(t(check.error));
        return;
      }
      setPendingCropFile(file);
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t("Couldn't read that image."));
    }
  }

  async function handleCropConfirmed(blob: Blob) {
    setPendingCropFile(null);
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const result = await apiUpload<AvatarPhotoUploadResult>("/me/employer-profile/photo", formData);
      await apiPatch("/me/employer-profile", { profilePictureUrl: result.url });
      // Have the browser fetch it first, so every place showing it (this box,
      // the header) swaps to the new photo at the same moment, with no gap.
      await preloadImage(result.url);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't upload that photo."));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setUploading(true);
    try {
      await apiPatch("/me/employer-profile", { profilePictureUrl: null });
      onChange(null);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't remove that photo."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFilePicked(file);
        }}
      />
      <div className="relative">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-label={t("Change photo")}
        className="group relative h-24 w-24 overflow-hidden rounded-full border border-border bg-surface-muted disabled:opacity-60"
      >
        {value ? (
          // Arbitrary uploaded photo, not a static/remote asset next/image
          // can optimize — same reasoning CompanyLogo/LogoCropper use.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-full w-full p-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" />
          </svg>
        )}
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <span className="text-xs font-medium text-white">{t("Uploading...")}</span>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          )}
        </span>
      </button>
      {value && (
        <button
          type="button"
          onClick={() => void handleRemove()}
          disabled={uploading}
          aria-label={t("Remove photo")}
          title={t("Remove photo and use your avatar again")}
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:bg-red-600 hover:text-white disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
      </div>

      {error && <p className="max-w-[200px] text-center text-xs text-red-600 dark:text-red-300">{error}</p>}
      <p className="text-[11px] text-muted-foreground">{t("Recommended 800x800")}</p>

      {pendingCropFile && (
        <AvatarPhotoCropper
          file={pendingCropFile}
          onConfirm={(blob) => void handleCropConfirmed(blob)}
          onCancel={() => setPendingCropFile(null)}
        />
      )}
    </div>
  );
}
