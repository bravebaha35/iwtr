"use client";

import { SectorBenchmarkTile } from "@/components/owner/SectorBenchmarkTile";
import { HrAnalyticsReportTile } from "@/components/owner/HrAnalyticsReportTile";

function ReportBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface p-5">
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
  return (
    <div className="rounded-xl border border-border p-6">
      <h3 className="mb-1 font-semibold text-foreground">Benchmark Reports</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        PDF reports built only from anonymous review data. Each report stays available to download for 7 days.
      </p>
      <div className="flex flex-col gap-4">
        <ReportBox title="Sector Benchmark Report">
          <SectorBenchmarkTile companyId={companyId} isEnterprise={isEnterprise} city={city} />
        </ReportBox>
        <ReportBox title="HR Analytics Report">
          <HrAnalyticsReportTile />
        </ReportBox>
      </div>
    </div>
  );
}
