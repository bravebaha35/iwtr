"use client";

import { useEffect, useRef, useState } from "react";
import { AVATAR_RECOMMENDED_DIMENSION_PX } from "@iwtr/shared-types";
import { baseScaleFor, clampOffset, recenterOffsetOnZoom, sourceRectFor } from "@/lib/cropMath";

const VIEWPORT_PX = 280;
// Compressed JPEG quality — chosen for a small file size while staying
// visually clean for a face-sized photo; not user-configurable.
const JPEG_QUALITY = 0.82;

/**
 * Square-crop-with-pan-and-zoom overlay for the employer avatar photo — a
 * fork of LogoCropper.tsx (not a shared/generalized component) so the
 * existing company-logo upload path can't regress: same geometry (all pan/
 * zoom/source-rect math reused from lib/cropMath.ts) but exports a
 * compressed JPEG at AVATAR_RECOMMENDED_DIMENSION_PX instead of a PNG at the
 * logo's size, which is the frontend "image compression" step the photo
 * upload feature needs.
 */
export function AvatarPhotoCropper({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    setZoom(1);
    const base = baseScaleFor(img.naturalWidth, img.naturalHeight, VIEWPORT_PX);
    setOffset({
      x: (VIEWPORT_PX - img.naturalWidth * base) / 2,
      y: (VIEWPORT_PX - img.naturalHeight * base) / 2,
    });
  }

  const scale = natural ? baseScaleFor(natural.width, natural.height, VIEWPORT_PX) * zoom : 1;

  function clampToBounds(next: { x: number; y: number }, atScale: number): { x: number; y: number } {
    if (!natural) return next;
    return {
      x: clampOffset({ offset: next.x, displayedSize: natural.width * atScale, viewport: VIEWPORT_PX }),
      y: clampOffset({ offset: next.y, displayedSize: natural.height * atScale, viewport: VIEWPORT_PX }),
    };
  }

  function onZoomChange(nextZoom: number) {
    if (!natural) return;
    const oldScale = scale;
    const newScale = baseScaleFor(natural.width, natural.height, VIEWPORT_PX) * nextZoom;
    const recentered = {
      x: recenterOffsetOnZoom({ offset: offset.x, oldScale, newScale, viewport: VIEWPORT_PX }),
      y: recenterOffsetOnZoom({ offset: offset.y, oldScale, newScale, viewport: VIEWPORT_PX }),
    };
    setZoom(nextZoom);
    setOffset(clampToBounds(recentered, newScale));
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const next = {
      x: drag.startOffset.x + (e.clientX - drag.startX),
      y: drag.startOffset.y + (e.clientY - drag.startY),
    };
    setOffset(clampToBounds(next, scale));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function confirm() {
    if (!imgRef.current || !natural) return;
    setExporting(true);
    const { sx, sy, sSize } = sourceRectFor({ offsetX: offset.x, offsetY: offset.y, scale, viewport: VIEWPORT_PX });
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_RECOMMENDED_DIMENSION_PX;
    canvas.height = AVATAR_RECOMMENDED_DIMENSION_PX;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(
      imgRef.current,
      sx,
      sy,
      sSize,
      sSize,
      0,
      0,
      AVATAR_RECOMMENDED_DIMENSION_PX,
      AVATAR_RECOMMENDED_DIMENSION_PX,
    );
    canvas.toBlob(
      (blob) => {
        setExporting(false);
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-foreground">Drag to reposition, use the slider to zoom</p>
        <div
          className="relative touch-none overflow-hidden rounded-full border border-border bg-surface-muted"
          style={{ width: VIEWPORT_PX, height: VIEWPORT_PX }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {objectUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={objectUrl}
              alt=""
              draggable={false}
              onLoad={onImageLoad}
              className="absolute left-0 top-0 max-w-none select-none"
              style={
                natural
                  ? { width: natural.width * scale, height: natural.height * scale, left: offset.x, top: offset.y }
                  : undefined
              }
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          disabled={!natural}
          className="w-full"
          aria-label="Zoom"
        />
        <div className="flex gap-2 self-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!natural || exporting}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {exporting ? "Saving..." : "Use this photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
