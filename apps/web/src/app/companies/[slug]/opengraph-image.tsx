import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { scoreBandLabel, type CompanyDetail } from "@iwtr/shared-types";
import { apiGetPublic } from "@/lib/api-client";

export const alt = "Anonymous workplace reviews on I Worked There";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview for one company: its name and overall score, so a shared
// link reads like the page it points to.
export default async function CompanyOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const mark = await readFile(join(process.cwd(), "public", "brand-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  let name = "A workplace";
  let scoreLine = "Read anonymous reviews from people who worked there";
  try {
    const { company, aggregate } = await apiGetPublic<CompanyDetail>(`/companies/${slug}`);
    name = company.name;
    if (aggregate && aggregate.reviewCount > 0) {
      scoreLine = `${aggregate.overallAvg.toFixed(1)} / 5 · ${scoreBandLabel(aggregate.overallAvg)} · ${aggregate.reviewCount} review${aggregate.reviewCount === 1 ? "" : "s"}`;
    }
  } catch {
    // Unknown company: generic card.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: "#fbfaf5",
          borderBottom: "24px solid #3f6b3a",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img src={markSrc} width={84} height={84} alt="" />
          <div style={{ fontSize: 40, color: "#4a3018" }}>I Worked There</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: name.length > 28 ? 64 : 84, color: "#4a3018", lineHeight: 1.05 }}>{name}</div>
          <div style={{ fontSize: 40, color: "#8b5a2b" }}>{scoreLine}</div>
        </div>
      </div>
    ),
    size,
  );
}
