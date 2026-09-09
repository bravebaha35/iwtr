"use client";

import { useRef, useState } from "react";
import type { OwnedCompany } from "@iwtr/shared-types";
import { validateSocialImageUpload } from "@iwtr/shared-types";
import { apiUpload, ApiError } from "@/lib/api-client";

export function SocialComposer({
  companies,
  onPosted,
  onCancel,
}: {
  companies: OwnedCompany[];
  onPosted: () => void;
  onCancel: () => void;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.companyId ?? "");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const check = validateSocialImageUpload({ mimeType: f.type, sizeBytes: f.size });
    if (!check.valid) {
      setError(check.error);
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) {
      setError("Add a photo to post.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("companyId", companyId);
      if (caption.trim()) fd.set("caption", caption.trim());
      fd.set("file", file);
      await apiUpload<{ id: string }>("/social/posts", fd);
      setCaption("");
      setFile(null);
      setPreviewUrl(null);
      onPosted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      {companies.length > 1 && (
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="mb-2 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
        >
          {companies.map((c) => (
            <option key={c.companyId} value={c.companyId}>
              {c.companyName}
            </option>
          ))}
        </select>
      )}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Tell us what you think !"
        rows={3}
        maxLength={1000}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
      />

      <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-surface-muted">
        <span className="text-lg leading-none">+</span> Add a photo
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif"
          aria-label="Add a photo"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </label>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={previewUrl} alt="" className="mt-2 max-h-64 w-full rounded-lg object-cover" />
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Posting..." : "Post"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
