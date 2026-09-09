"use client";

import { useRef, useState } from "react";
import type { OwnedCompany } from "@iwtr/shared-types";
import { validateSocialImageUpload, MAX_SOCIAL_POST_IMAGES } from "@iwtr/shared-types";
import { apiUpload, ApiError } from "@/lib/api-client";

interface Picked {
  file: File;
  previewUrl: string;
}

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
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Instagram-style multi-photo picker: each newly chosen batch is appended
  // to whatever's already picked (up to MAX_SOCIAL_POST_IMAGES), not
  // replaced - so tapping "Add a photo" again adds more instead of
  // resetting the selection.
  function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_SOCIAL_POST_IMAGES - picked.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_SOCIAL_POST_IMAGES} photos.`);
      return;
    }
    const next: Picked[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      const check = validateSocialImageUpload({ mimeType: f.type, sizeBytes: f.size });
      if (!check.valid) {
        setError(check.error);
        return;
      }
      next.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    setError(null);
    setPicked((prev) => [...prev, ...next]);
  }

  function removePicked(index: number) {
    setPicked((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function submit() {
    if (picked.length === 0) {
      setError("Add at least one photo to post.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("companyId", companyId);
      if (caption.trim()) fd.set("caption", caption.trim());
      for (const p of picked) fd.append("files", p.file);
      await apiUpload<{ id: string }>("/social/posts", fd);
      picked.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setCaption("");
      setPicked([]);
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
        <span className="text-lg leading-none">+</span> Add a photo{picked.length > 0 ? "" : " (or a few)"}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/heif"
          aria-label="Add a photo"
          className="hidden"
          onChange={(e) => {
            pickFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {picked.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {picked.map((p, i) => (
            <div key={`${i}-${p.previewUrl}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={p.previewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removePicked(i)}
                aria-label="Remove this photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background shadow"
              >
                ×
              </button>
            </div>
          ))}
        </div>
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
