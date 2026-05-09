import { z } from "zod";

export const ReportAbnormalLabsInput = z.object({
  labsImpressionText: z.string().min(1, "labsImpressionText is required"),
  clinicalNotes: z.string().optional()
});
