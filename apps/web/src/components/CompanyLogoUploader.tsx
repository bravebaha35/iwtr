"use client";

import { useRef, useState } from "react";
import { validateSourceImageForCrop, LOGO_MAX_FILE_SIZE_BYTES, type LogoUploadResult } from "@iwtr/shared-types";
import { apiUpload, ApiError } from "@/lib/api-client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { LogoCropper } from "@/components/LogoCropper";

type LogoMode = "upload" | "url";

function pillClass(active: boolean): string {
  return `flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "border-brand-600 bg-surface text-brand-700 dark:text-brand-400"
      : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
  }`;
}

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

/**
 * "Company Logo" field for the owner dashboard: upload a PNG file, or paste
 * a URL — two icon-labeled modes rather than one field trying to do both.
 * A picked file isn't uploaded immediately — it first opens `LogoCropper` so
 * the owner can crop any aspect-ratio photo down to the square logo, rather
 * than this component rejecting non-square photos outright. The raw picked
 * file is checked client-side first (`validateSourceImageForCrop` — PNG,
 * size, and enough resolution for a good crop, deliberately NOT square) for
 * instant feedback before the crop UI opens; the cropped square export is
 * then what's actually uploaded, checked authoritatively server-side
 * (OwnerService.uploadLogo) via `validateLogoFile` — the server never trusts
 * either client-side pass alone. A pasted URL isn't run through either
 * check: doing so would mean the API fetching an arbitrary user-supplied URL
 * itself, which is a real SSRF risk this deliberately avoids — pasted URLs
 * just go through the existing httpUrlSchema check, same as before.
 */
export function CompanyLogoUploader({
  companyId,
  companyName,
  value,
  onChange,
}: {
  companyId: string;
  companyName: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [mode, setMode] = useState<LogoMode>("url");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilePicked(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const { width, height } = await readImageDimensions(file);
      const check = validateSourceImageForCrop({ mimeType: file.type, sizeBytes: file.size, width, height });
      if (!check.valid) {
        setError(check.error);
        return;
      }
      setPendingCropFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    }
  }

  async function handleCropConfirmed(blob: Blob) {
    setPendingCropFile(null);
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "logo.png");
      const result = await apiUpload<LogoUploadResult>(`/my-companies/${companyId}/logo`, formData);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("upload")} className={pillClass(mode === "upload")}>
          <svg viewBox="-8 0 32 32" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M226,155 L226,175 C226,178.313 223.313,181 220,181 C216.687,181 214,178.313 214,175 L214,157 C214,154.791 215.791,153 218,153 C220.209,153 222,154.791 222,157 L222,175 C222,176.104 221.104,177 220,177 C218.896,177 218,176.104 218,175 L218,159 L216,159 L216,175 C216,177.209 217.791,179 220,179 C222.209,179 224,177.209 224,175 L224,157 C224,153.687 221.313,151 218,151 C214.687,151 212,153.687 212,157 L212,176 C212.493,179.945 215.921,183 220,183 C224.079,183 227.507,179.945 228,176 L228,155 L226,155" />
          </svg>
          Upload from PC
        </button>
        <button type="button" onClick={() => setMode("url")} className={pillClass(mode === "url")}>
          <svg viewBox="0 -0.5 21 21" className="h-3.5 w-3.5" fill="currentColor">
            <g transform="translate(-299,-600)">
              <g transform="translate(56,160)">
                <path d="M246.400111,448.948654 C244.519883,447.158547 244.754644,444.106996 247.102248,442.631229 C248.809889,441.557573 251.103895,441.880078 252.551048,443.257869 L253.222099,443.896756 C253.641237,444.295804 254.319791,444.295804 254.737858,443.896756 C255.156996,443.498727 255.156996,442.852696 254.737858,442.453648 L254.170788,441.913758 C251.680612,439.542937 247.589992,439.302079 245.025851,441.600438 C242.372737,443.979423 242.32557,447.956645 244.884352,450.391762 L245.642231,451.113316 C246.060298,451.512365 246.739924,451.512365 247.15799,451.113316 C247.577129,450.715288 247.577129,450.069257 247.15799,449.670208 L246.400111,448.948654 Z M261.976841,449.345662 L261.430138,448.825163 C261.011,448.426114 260.332446,448.426114 259.914379,448.825163 C259.495241,449.223192 259.495241,449.869222 259.914379,450.268271 L260.585429,450.907158 C262.032583,452.284948 262.370252,454.469002 261.243616,456.094794 C259.693554,458.329877 256.487306,458.552364 254.60815,456.763278 L253.850271,456.041724 C253.431132,455.642675 252.752578,455.642675 252.334511,456.041724 C251.915373,456.439752 251.915373,457.085783 252.334511,457.484832 L253.092391,458.206386 C255.643669,460.63538 259.806111,460.597618 262.305934,458.09106 C264.742511,455.648799 264.478808,451.727709 261.976841,449.345662 L261.976841,449.345662 Z M257.639668,455.32017 L247.91587,446.062438 C247.497803,445.663389 247.497803,445.017358 247.91587,444.61831 C248.335008,444.220281 249.013562,444.220281 249.431629,444.61831 L259.156499,453.876041 C259.574566,454.27509 259.574566,454.921121 259.156499,455.32017 C258.737361,455.718198 258.058807,455.718198 257.639668,455.32017 L257.639668,455.32017 Z" />
              </g>
            </g>
          </svg>
          Paste a URL
        </button>
      </div>

      {mode === "upload" ? (
        <div key="upload" className="flex items-center gap-2">
          <CompanyLogo name={companyName} mainPhotoUrl={value.trim() || null} size="sm" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
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
            {uploading ? "Uploading..." : "Choose PNG file..."}
          </button>
        </div>
      ) : (
        <div key="url" className="flex items-center gap-2">
          <CompanyLogo name={companyName} mainPhotoUrl={value.trim() || null} size="sm" />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <p className="text-[11px] text-muted-foreground">
        PNG, under {LOGO_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB. You&apos;ll be able to crop it to a square after
        choosing a file.
      </p>

      {pendingCropFile && (
        <LogoCropper
          file={pendingCropFile}
          onConfirm={(blob) => void handleCropConfirmed(blob)}
          onCancel={() => setPendingCropFile(null)}
        />
      )}
    </div>
  );
}
