import { ReportAbnormalLabsInput } from "./schema.js";

const TAG = "[REPORT_VIEW:ABNORMAL_LABS_AND_IMAGING]";

export async function handleReportAbnormalLabsOverview(raw: unknown): Promise<{
  content: string;
  meta: Record<string, unknown>;
}> {
  const p = ReportAbnormalLabsInput.parse(raw);
  const extras = p.clinicalNotes?.trim();
  const content = extras?.length
    ? `${TAG}\n${p.labsImpressionText.trim()}\n\nClinical notes (synthetic): ${extras}`
    : `${TAG}\n${p.labsImpressionText.trim()}`;
  return {
    content,
    meta: { kind: "report-abnormal-labs-overview" }
  };
}
