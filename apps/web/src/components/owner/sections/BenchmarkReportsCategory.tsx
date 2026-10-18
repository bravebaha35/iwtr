"use client";

import { SectorBenchmarkTile } from "@/components/owner/SectorBenchmarkTile";
import { HrAnalyticsReportTile } from "@/components/owner/HrAnalyticsReportTile";
import { useT } from "@/lib/i18n/client";

function ReportBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl bg-surface shadow-xs p-5">
      <h4 className="mb-2 font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  );
}

/** Premium Features › Benchmark Reports: the Sector Benchmark Report and the HR Analytics Report. */
export function BenchmarkReportsCategory({
  companyId,
  isEnterprise,
  city,
}: {
  companyId: string;
  isEnterprise: boolean;
  city: string | null;
}) {
  const t = useT();
  return (
    <div className="rounded-2xl bg-surface p-7 shadow-xs">
      <h3 className="mb-1 font-semibold text-foreground">{t("Benchmark Reports")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("PDF reports built only from anonymous review data. Each report stays available to download for 7 days.")}
      </p>
      <div className="flex flex-col gap-4">
        <ReportBox title={t("Sector Benchmark Report")}>
          <SectorBenchmarkTile companyId={companyId} isEnterprise={isEnterprise} city={city} />
        </ReportBox>
        <ReportBox title={t("HR Analytics Report")}>
          <HrAnalyticsReportTile companyId={companyId} />
        </ReportBox>
      </div>
    </div>
  );
}
