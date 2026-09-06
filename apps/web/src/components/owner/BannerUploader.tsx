"use client";

import { useRef, useState } from "react";
import type { LogoUploadResult } from "@iwtr/shared-types";
import { apiUpload, ApiError } from "@/lib/api-client";

/**
 * Premium Features box's banner image field — unlike CompanyLogoUploader,
 * this is a wide image with no fixed aspect ratio, so it skips the
 * square-crop step entirely: pick a file (uploaded as-is) or paste a URL.
 * Server-side validation (OwnerService.uploadBanner) is the same
 * validateLogoFile check the logo uploader already relies on.
 */
export function BannerUploader({
  uploadPath,
  value,
  onChange,
}: {
  uploadPath: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilePicked(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name || "banner.png");
      const result = await apiUpload<LogoUploadResult>(uploadPath, formData);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.trim() && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary owner-supplied URL, not a static/known-domain asset
        <img src={value} alt="Banner preview" className="h-20 w-full rounded-lg border border-border object-cover" />
      )}
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Choose image..."}
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or paste an https:// URL"
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
