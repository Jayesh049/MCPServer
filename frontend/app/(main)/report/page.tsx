import { Suspense } from "react";
import { StunningReportAnalyzer } from "../../../components/stunning/StunningReportAnalyzer";

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div style={{ color: "var(--txt3)", fontSize: 12 }}>
          <span className="spin" /> Loading…
        </div>
      }
    >
      <StunningReportAnalyzer />
    </Suspense>
  );
}
