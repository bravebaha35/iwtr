import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "I Worked There — anonymous workplace reviews";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview shown when any page is shared (pages can add their own
// opengraph-image to override). Built from the brand mark and the site's
// natural "habitat" colours: birch background, wood accents.
export default async function OpenGraphImage() {
  const mark = await readFile(join(process.cwd(), "public", "brand-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 88px",
          background: "#fbfaf5",
          borderBottom: "24px solid #8b5a2b",
          fontFamily: "serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
        <img src={markSrc} width={300} height={300} alt="" style={{ borderRadius: 64 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 88, color: "#4a3018", lineHeight: 1 }}>I Worked There</div>
          <div style={{ fontSize: 40, color: "#8b5a2b", lineHeight: 1.25, maxWidth: 680 }}>
            No names. No HR. Just what it&apos;s really like to work there.
          </div>
          <div style={{ fontSize: 28, color: "#8b5a2b", marginTop: 8 }}>iworkedthere.com</div>
        </div>
      </div>
    ),
    size,
  );
}
