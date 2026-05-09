import { z } from "zod";

export const ReportMedicationSafetyInput = z.object({
  medicationsAndLabsText: z.string().min(1, "medicationsAndLabsText is required"),
  allergiesAndRenalNotes: z.string().optional()
});
