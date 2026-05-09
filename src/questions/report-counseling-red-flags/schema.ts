import { z } from "zod";

export const ReportCounselingInput = z.object({
  reportExcerpt: z.string().min(1, "reportExcerpt is required"),
  audienceNote: z
    .string()
    .optional()
    .describe("e.g. shared decision-making focus, language barriers (synthetic note only)")
});
