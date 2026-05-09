import type { RagQuestionCatalogEntry } from "./catalog.js";
import { ragQuestionCatalog } from "./catalog.js";
import { handleReportAbnormalLabsOverview } from "./report-abnormal-labs-overview/handler.js";
import { handleReportDifferentialDiagnoses } from "./report-differential-diagnoses/handler.js";
import { handleReportFollowUpPlan } from "./report-follow-up-plan/handler.js";
import { handleReportMedicationSafety } from "./report-medication-safety-review/handler.js";
import { handleReportCounselingRedFlags } from "./report-counseling-red-flags/handler.js";

export type QuestionCorpusNormalize = (
  payload: unknown
) => Promise<{ content: string; meta: Record<string, unknown> }>;

const handlers: Record<string, QuestionCorpusNormalize> = {
  "report-abnormal-labs-overview": handleReportAbnormalLabsOverview,
  "report-differential-diagnoses": handleReportDifferentialDiagnoses,
  "report-follow-up-plan": handleReportFollowUpPlan,
  "report-medication-safety-review": handleReportMedicationSafety,
  "report-counseling-red-flags": handleReportCounselingRedFlags
};

export function listRagQuestions(): RagQuestionCatalogEntry[] {
  return ragQuestionCatalog;
}

export function getRagQuestionHandler(slug: string): QuestionCorpusNormalize | undefined {
  return handlers[slug];
}

export function isRegisteredRagSlug(slug: string): boolean {
  return slug in handlers;
}

export function ragToolNameFromSlug(slug: string): string {
  return `rq_${slug.replace(/-/g, "_")}`;
}

export function ragSlugFromToolName(name: string): string | undefined {
  if (!name.startsWith("rq_")) return undefined;
  const rest = name.slice(3).replace(/_/g, "-");
  return isRegisteredRagSlug(rest) ? rest : undefined;
}
