"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO_RECOMMENDED_DIMENSION_PX } from "@iwtr/shared-types";
import { baseScaleFor, clampOffset, recenterOffsetOnZoom, sourceRectFor } from "@/lib/cropMath";

const VIEWPORT_PX = 280;

/**
 * Square-crop-with-pan-and-zoom overlay for the "Company Logo" field — opens
 * after a file is picked (any aspect ratio, see validateSourceImageForCrop),
 * lets the owner drag/zoom to choose which square region becomes the logo,
 * then exports exactly that region as a LOGO_RECOMMENDED_DIMENSION_PX square
 * PNG blob. All the geometry (scale/offset/source-rect math) lives in
 * lib/cropMath.ts, kept pure and unit-tested separately from this pointer-
 * event/canvas glue, which isn't meaningfully testable under jsdom.
 */
export function LogoCropper({
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
    // Canonical React "sync with an external system + cleanup" case — the
    // URL must be revoked on unmount/file-change, which only a real effect
    // (not useMemo, which has no cleanup) can guarantee.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    setZoom(1);
    // Center the base-scaled image in the viewport: baseScale makes the
    // shorter side exactly VIEWPORT_PX, so the longer side overhangs evenly
    // on both sides — center it by offsetting half that overhang negative.
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
    canvas.width = LOGO_RECOMMENDED_DIMENSION_PX;
    canvas.height = LOGO_RECOMMENDED_DIMENSION_PX;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, LOGO_RECOMMENDED_DIMENSION_PX, LOGO_RECOMMENDED_DIMENSION_PX);
    canvas.toBlob((blob) => {
      setExporting(false);
      if (blob) onConfirm(blob);
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium text-foreground">Drag to reposition, use the slider to zoom</p>
        <div
          className="relative touch-none overflow-hidden rounded-lg border border-border bg-surface-muted"
          style={{ width: VIEWPORT_PX, height: VIEWPORT_PX }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {objectUrl && (
            // An arbitrary user-picked local file, not a static/remote
            // asset next/image can optimize.
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
            {exporting ? "Saving..." : "Use this crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
