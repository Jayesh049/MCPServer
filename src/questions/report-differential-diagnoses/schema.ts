import { z } from "zod";

export const ReportDifferentialInput = z.object({
  reportExcerpt: z.string().min(1, "reportExcerpt is required"),
  chiefConcern: z.string().optional()
});
