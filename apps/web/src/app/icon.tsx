import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Generated favicon — reuses the same beaver mark as components/Logo.tsx so
// the browser tab matches the header logo. Colors are hardcoded (not read
// from globals.css) because this renders via Satori, outside the page's CSS;
// keep --color-brand-600 here in sync if the palette changes. Swap this whole
// file out once real favicon artwork exists — Next.js also honors a plain
// favicon.ico/icon.png dropped in this same app/ directory, which would take
// priority over this generated one.
const BRAND_600 = "#ea580c";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_600,
          borderRadius: 6,
        }}
      >
        <svg viewBox="0 0 24 24" width="23" height="23">
          <circle cx="7" cy="6.5" r="2.3" fill="white" />
          <circle cx="17" cy="6.5" r="2.3" fill="white" />
          <circle cx="12" cy="12.5" r="7.5" fill="white" />
          <circle cx="9" cy="11.5" r="1" fill={BRAND_600} />
          <circle cx="15" cy="11.5" r="1" fill={BRAND_600} />
          <rect x="9.8" y="16.5" width="4.4" height="3.2" rx="0.8" fill="white" />
          <rect x="11.7" y="16.5" width="0.6" height="3.2" fill={BRAND_600} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
