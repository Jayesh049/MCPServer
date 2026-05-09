import { z } from "zod";
import { listDiseases } from "../diseases/registry.js";

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  inputZod: z.ZodTypeAny;
  requiresFhirContext?: boolean;
  domain?: "care-gap" | "disease" | "care-plan";
  diseaseSlug?: string;
};

const GetPatientFactsInput = z.object({
  dateRange: z
    .object({
      start: z.string().optional(),
      end: z.string().optional()
    })
    .optional()
});

const IdentifyCareGapsInput = z.object({
  noteText: z.string().min(1).optional()
});

const ComputeRiskTableInput = z.object({
  facts: z.unknown(),
  extractedSignals: z.unknown()
});

const RenderOutputTableInput = z.object({
  table: z.unknown()
});

const DiseasePredictInputZod = z.object({
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
  imageByteLength: z.number().optional(),
  imageHash: z.string().optional(),
  form: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
});

const CarePlanInputZod = z.object({
  diseaseSlug: z.string().min(1)
});

const ReportAnalyzeInputZod = z.object({
  pdfBase64: z.string().min(1).optional(),
  pdfFilename: z.string().optional(),
  pdfText: z.string().min(1).optional()
});

function diseaseSlugToToolName(slug: string): string {
  return `disease_${slug.replace(/-/g, "_")}_pipeline`;
}

const careGapTools: ToolDef[] = [
  {
    name: "get_patient_facts",
    title: "Get Patient Facts",
    description:
      "Fetch normalized facts for the current patient from FHIR context (synthetic-only demo adapter).",
    inputZod: GetPatientFactsInput,
    inputSchema: {
      type: "object",
      properties: {
        dateRange: {
          type: "object",
          properties: { start: { type: "string" }, end: { type: "string" } }
        }
      }
    },
    requiresFhirContext: true,
    domain: "care-gap"
  },
  {
    name: "identify_care_gaps",
    title: "Identify Care Gaps",
    description:
      "Use an LLM-like extractor to identify likely care gaps or anomalies from patient facts and optional synthetic note text.",
    inputZod: IdentifyCareGapsInput,
    inputSchema: {
      type: "object",
      properties: { noteText: { type: "string" } }
    },
    requiresFhirContext: true,
    domain: "care-gap"
  },
  {
    name: "compute_risk_table",
    title: "Compute Care-Gap Risk Table",
    description:
      "Combine extracted signals with deterministic scoring to produce a structured care-gap table.",
    inputZod: ComputeRiskTableInput,
    inputSchema: {
      type: "object",
      properties: { facts: {}, extractedSignals: {} },
      required: ["facts", "extractedSignals"]
    },
    requiresFhirContext: true,
    domain: "care-gap"
  },
  {
    name: "render_output_table",
    title: "Render Output Table",
    description:
      "Render the final care-gap table in a platform-friendly format (JSON).",
    inputZod: RenderOutputTableInput,
    inputSchema: {
      type: "object",
      properties: { table: {} },
      required: ["table"]
    },
    requiresFhirContext: true,
    domain: "care-gap"
  }
];

const diseaseTools: ToolDef[] = listDiseases().map((d) => ({
  name: diseaseSlugToToolName(d.slug),
  title: `Detect: ${d.name}`,
  description:
    `Run detection -> resolution -> solution pipeline for "${d.name}". ` +
    `Modality: ${d.modality}. Model kind: ${d.modelKind}. ` +
    `Provide either an image (base64) or form fields.`,
  inputZod: DiseasePredictInputZod,
  inputSchema: {
    type: "object",
    properties: {
      imageBase64: { type: "string" },
      imageMimeType: { type: "string" },
      imageByteLength: { type: "number" },
      imageHash: { type: "string" },
      form: { type: "object" }
    }
  },
  requiresFhirContext: false,
  domain: "disease",
  diseaseSlug: d.slug
}));

const carePlanTools: ToolDef[] = [
  {
    name: "care_plan_for_disease",
    title: "Get Care Plan for a Known Disease",
    description:
      "Returns a synthetic, education-only care plan for a known/diagnosed disease, including: " +
      "(1) recommended exercises for the healing phase, " +
      "(2) the top 5 doctors with 10 medications each and the hospitals where they work, and " +
      "(3) positive affirmations to support the patient's mindset. " +
      "All doctors, hospitals, and patient details are SYNTHETIC and fictional. Not clinical advice.",
    inputZod: CarePlanInputZod,
    inputSchema: {
      type: "object",
      properties: {
        diseaseSlug: {
          type: "string",
          description:
            "The disease slug (e.g. 'lung-cancer', 'diabetes', 'heart-disease', 'breast-cancer'). Use disease.list_supported to discover slugs."
        }
      },
      required: ["diseaseSlug"]
    },
    requiresFhirContext: false,
    domain: "care-plan"
  }
];

const reportTools: ToolDef[] = [
  {
    name: "analyze_patient_report_pdf",
    title: "Analyze Patient PDF Report (synthetic only)",
    description:
      "Accepts a patient report as PDF (base64) or as raw text and extracts likely known diseases, " +
      "then returns a synthetic education-only care plan (exercises, top doctors + medications + hospitals, " +
      "and positive manifestations). This runs locally and uses keyword matching. Do NOT upload PHI.",
    inputZod: ReportAnalyzeInputZod,
    inputSchema: {
      type: "object",
      properties: {
        pdfBase64: { type: "string", description: "Base64-encoded PDF bytes." },
        pdfFilename: { type: "string", description: "Optional filename for display." },
        pdfText: { type: "string", description: "Alternative to PDF: provide extracted report text." }
      }
    },
    requiresFhirContext: false,
    domain: "care-plan"
  }
];

export const tools: ToolDef[] = [...careGapTools, ...diseaseTools, ...carePlanTools, ...reportTools];

export { diseaseSlugToToolName };
