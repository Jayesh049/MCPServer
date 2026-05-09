import { ReportMedicationSafetyInput } from "./schema.js";

const TAG = "[REPORT_VIEW:MEDICATION_AND_SAFETY]";

export async function handleReportMedicationSafety(raw: unknown): Promise<{
  content: string;
  meta: Record<string, unknown>;
}> {
  const p = ReportMedicationSafetyInput.parse(raw);
  const allergy = p.allergiesAndRenalNotes?.trim();
  const content = allergy?.length
    ? `${TAG}\nMeds/labs/context:\n${p.medicationsAndLabsText.trim()}\n\nAllergies / organ function notes:\n${allergy}`
    : `${TAG}\nMeds/labs/context:\n${p.medicationsAndLabsText.trim()}`;
  return {
    content,
    meta: { kind: "report-medication-safety-review" }
  };
}
