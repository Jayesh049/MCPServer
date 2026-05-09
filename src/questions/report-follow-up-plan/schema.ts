import { z } from "zod";

export const ReportFollowUpInput = z.object({
  reportExcerpt: z.string().min(1, "reportExcerpt is required"),
  specialtyContext: z.string().optional()
});
