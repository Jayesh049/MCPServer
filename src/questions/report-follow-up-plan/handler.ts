import { ReportFollowUpInput } from "./schema.js";

const TAG = "[REPORT_VIEW:FOLLOW_UP_REFERRALS_TESTS]";

export async function handleReportFollowUpPlan(raw: unknown): Promise<{
  content: string;
  meta: Record<string, unknown>;
}> {
  const p = ReportFollowUpInput.parse(raw);
  const spec = p.specialtyContext?.trim();
  const content = spec?.length
    ? `${TAG}\nSpecialty / pathway context (synthetic): ${spec}\n\nReport excerpt:\n${p.reportExcerpt.trim()}`
    : `${TAG}\nReport excerpt:\n${p.reportExcerpt.trim()}`;
  return {
    content,
    meta: { kind: "report-follow-up-plan" }
  };
}
