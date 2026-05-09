import { ReportCounselingInput } from "./schema.js";

const TAG = "[REPORT_VIEW:COUNSELING_AND_RED_FLAGS]";

export async function handleReportCounselingRedFlags(raw: unknown): Promise<{
  content: string;
  meta: Record<string, unknown>;
}> {
  const p = ReportCounselingInput.parse(raw);
  const aud = p.audienceNote?.trim();
  const content = aud?.length
    ? `${TAG}\nAudience / counseling focus (synthetic): ${aud}\n\nReport excerpt:\n${p.reportExcerpt.trim()}`
    : `${TAG}\nReport excerpt:\n${p.reportExcerpt.trim()}`;
  return {
    content,
    meta: { kind: "report-counseling-red-flags" }
  };
}
