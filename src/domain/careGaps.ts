import { z } from "zod";

export const CareGapSeveritySchema = z.enum(["high", "medium", "low"]);

export const CareGapSchema = z.object({
  gapId: z.string().min(1),
  title: z.string().min(1),
  severity: CareGapSeveritySchema,
  confidence: z.number().min(0).max(1),
  due: z.string().optional(),
  evidence: z
    .array(
      z.object({
        source: z.enum(["fhir", "note", "inferred"]),
        snippet: z.string().min(1),
        fhirResourceRef: z.string().optional()
      })
    )
    .default([]),
  recommendedAction: z.string().min(1),
  impactHypothesis: z.string().min(1)
});

export type CareGap = z.infer<typeof CareGapSchema>;

export const CareGapTableSchema = z.object({
  patientId: z.string().min(1),
  generatedAt: z.string().min(1),
  gaps: z.array(CareGapSchema),
  summary: z.string().min(1)
});

export type CareGapTable = z.infer<typeof CareGapTableSchema>;

