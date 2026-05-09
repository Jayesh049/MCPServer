import { ReportDifferentialInput } from "./schema.js";

const TAG = "[REPORT_VIEW:DIFFERENTIAL_DIAGNOSES]";

export async function handleReportDifferentialDiagnoses(raw: unknown): Promise<{
  content: string;
  meta: Record<string, unknown>;
}> {
  const p = ReportDifferentialInput.parse(raw);
  const concern = p.chiefConcern?.trim();
  const content = concern?.length
    ? `${TAG}\nChief concern (synthetic): ${concern}\n\nReport excerpt:\n${p.reportExcerpt.trim()}`
    : `${TAG}\nReport excerpt:\n${p.reportExcerpt.trim()}`;
  return {
    content,
    meta: { kind: "report-differential-diagnoses" }
  };
}
