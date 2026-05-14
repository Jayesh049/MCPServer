import { z } from "zod";
import { listDiseases } from "../diseases/registry.js";

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  inputZod: z.ZodTypeAny;
  requiresFhirContext?: boolean;
  domain?: "care-gap" | "disease" | "care-plan" | "rag-web" | "manual-question" | "disease-ml";
  diseaseSlug?: string;
  manualQuestionId?: "q2" | "q3" | "q4";
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

const ManualQ2InputZod = z.object({
  diseaseSlug: z.string().min(1).describe("Known disease slug (e.g. diabetes, lung-cancer).")
});

const ManualQ3InputZod = z.object({
  diseaseSlug: z.string().min(1),
  stage: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe("Clinical stage band (demo buckets 1–3).")
});

const ManualQ4InputZod = z
  .object({
    pdfText: z.string().optional(),
    pdfBase64: z.string().optional(),
    pdfFilename: z.string().optional()
  })
  .refine((d) => !!(d.pdfText?.trim() || d.pdfBase64?.trim()), {
    message: "Provide pdfText or pdfBase64."
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

const AskWebRagInputZod = z.object({
  question: z
    .string()
    .min(3)
    .describe("Natural-language question. Wikipedia is searched, chunks are embedded (free local model by default) and stored."),
  refresh: z
    .boolean()
    .optional()
    .describe("If true, re-fetch Wikipedia and rebuild the corpus for this question even if data already exists.")
});

const CorpusMlFileZod = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1),
  trainingLabel: z.union([z.literal(0), z.literal(1)]).optional()
});

const DiseaseCorpusMlIngestInputZod = z.object({
  diseaseSlug: z.string().min(1),
  functionality: z.string().optional(),
  files: z.array(CorpusMlFileZod).min(1).max(25),
  trainingLabel: z.union([z.literal(0), z.literal(1)]).optional()
});

const DiseaseCorpusMlTrainInputZod = z.object({
  diseaseSlug: z.string().min(1),
  functionality: z.string().optional(),
  formulaKey: z.string().optional().describe("e.g. tfidf_lr, tfidf_svd_lr, hashing_svc — creates config if missing."),
  hyperparams: z.record(z.string(), z.unknown()).optional()
});

const DiseaseCorpusMlModelsInputZod = z.object({
  diseaseSlug: z.string().min(1),
  functionality: z.string().optional()
});

const DiseaseCorpusMlPredictInputZod = z.object({
  diseaseSlug: z.string().min(1),
  functionality: z.string().optional(),
  text: z.string().min(1).describe("Free text to classify with the latest trained model for this slug/functionality.")
});

const AskBankRagInputZod = z.object({
  slug: z
    .string()
    .regex(/^qb_\d{3}$/)
    .describe("Bank slug from the 100-question list (e.g. qb_001). Run db:train-bank first to index."),
  refresh: z.boolean().optional()
});

const manualQuestionTools: ToolDef[] = [
  {
    name: "manual_q2_home_remedies_doctors",
    title: "Manual Q2 — Home remedies then top doctors",
    description:
      "Demo flow: for a disease slug, returns education-only home/lifestyle remedies (exercises + affirmations), then the synthetic top 5 doctors from the care plan. Not clinical advice.",
    inputZod: ManualQ2InputZod,
    inputSchema: {
      type: "object",
      properties: {
        diseaseSlug: { type: "string", description: "Disease slug from the disease catalog." }
      },
      required: ["diseaseSlug"]
    },
    requiresFhirContext: false,
    domain: "manual-question",
    manualQuestionId: "q2"
  },
  {
    name: "manual_q3_stage_doctors",
    title: "Manual Q3 — Doctors ranked by stage (1 / 2 / 3)",
    description:
      "Demo flow: same synthetic specialists as the care plan, re-ordered by stage (early vs intermediate vs advanced framing). All personas fictional.",
    inputZod: ManualQ3InputZod,
    inputSchema: {
      type: "object",
      properties: {
        diseaseSlug: { type: "string" },
        stage: { type: "integer", enum: [1, 2, 3], description: "Stage bucket." }
      },
      required: ["diseaseSlug", "stage"]
    },
    requiresFhirContext: false,
    domain: "manual-question",
    manualQuestionId: "q3"
  },
  {
    name: "manual_q4_health_report_outline",
    title: "Manual Q4 — Health report → disease, cure, solution",
    description:
      "Demo flow: parses PDF or raw report text, detects diseases via keywords, returns structured disease + supportive cure excerpt + specialist solution block (synthetic). Do not upload PHI.",
    inputZod: ManualQ4InputZod,
    inputSchema: {
      type: "object",
      properties: {
        pdfText: { type: "string", description: "Extracted report text." },
        pdfBase64: { type: "string", description: "Base64 PDF bytes." },
        pdfFilename: { type: "string" }
      }
    },
    requiresFhirContext: false,
    domain: "manual-question",
    manualQuestionId: "q4"
  }
];

const diseaseMlTools: ToolDef[] = [
  {
    name: "disease_corpus_ml_ingest",
    title: "Disease corpus ML — ingest PDFs/images (Flask sidecar)",
    description:
      "Uploads base64-encoded files to the disease ML service: extracts PDF text, stores rows in Postgres, " +
      "and saves binaries to configured storage (local or S3). Requires DISEASE_ML_URL. Educational demo only.",
    inputZod: DiseaseCorpusMlIngestInputZod,
    inputSchema: {
      type: "object",
      properties: {
        diseaseSlug: { type: "string" },
        functionality: { type: "string" },
        trainingLabel: { type: "integer", enum: [0, 1] },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              mimeType: { type: "string" },
              dataBase64: { type: "string" },
              trainingLabel: { type: "integer", enum: [0, 1] }
            },
            required: ["filename", "mimeType", "dataBase64"]
          }
        }
      },
      required: ["diseaseSlug", "files"]
    },
    requiresFhirContext: false,
    domain: "disease-ml"
  },
  {
    name: "disease_corpus_ml_train",
    title: "Disease corpus ML — train sklearn pipeline",
    description:
      "Trains the pipeline selected by DiseaseFunctionalityConfig.formulaKey (e.g. tfidf_lr for Alzheimer demo seed). " +
      "Uses extractedText from ingested assets; pseudo-labels when trainingLabel not set. Requires DISEASE_ML_URL.",
    inputZod: DiseaseCorpusMlTrainInputZod,
    inputSchema: {
      type: "object",
      properties: {
        diseaseSlug: { type: "string" },
        functionality: { type: "string" },
        formulaKey: { type: "string" },
        hyperparams: { type: "object" }
      },
      required: ["diseaseSlug"]
    },
    requiresFhirContext: false,
    domain: "disease-ml"
  },
  {
    name: "disease_corpus_ml_models",
    title: "Disease corpus ML — list trained models",
    description: "Returns recent DiseaseTrainedModel rows and metrics for a disease slug and functionality.",
    inputZod: DiseaseCorpusMlModelsInputZod,
    inputSchema: {
      type: "object",
      properties: {
        diseaseSlug: { type: "string" },
        functionality: { type: "string" }
      },
      required: ["diseaseSlug"]
    },
    requiresFhirContext: false,
    domain: "disease-ml"
  },
  {
    name: "disease_corpus_ml_predict",
    title: "Disease corpus ML — predict from text",
    description:
      "Runs the latest saved sklearn model on input text (binary demo class). Not for clinical use.",
    inputZod: DiseaseCorpusMlPredictInputZod,
    inputSchema: {
      type: "object",
      properties: {
        diseaseSlug: { type: "string" },
        functionality: { type: "string" },
        text: { type: "string" }
      },
      required: ["diseaseSlug", "text"]
    },
    requiresFhirContext: false,
    domain: "disease-ml"
  }
];

const ragWebTools: ToolDef[] = [
  {
    name: "ask_bank_rag",
    title: "Ask RAG by bank slug (qb_001 … qb_100)",
    description:
      "Runs retrieval for a pre-seeded bank question slug after `npm run db:train-bank`. Uses stored Wikipedia chunks and embeddings; optional refresh rebuilds from Wikipedia.",
    inputZod: AskBankRagInputZod,
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", pattern: "^qb_[0-9]{3}$" },
        refresh: { type: "boolean" }
      },
      required: ["slug"]
    },
    requiresFhirContext: false,
    domain: "rag-web"
  },
  {
    name: "ask_web_rag",
    title: "Ask Web RAG (Wikipedia + free embeddings)",
    description:
      "Searches Wikipedia for the question, downloads article intros, chunks and embeds them into Postgres (Transformers.js when no OpenAI key), " +
      "then returns the top similar passages. First call indexes; repeat calls reuse the index unless refresh=true. Educational demo—not medical advice.",
    inputZod: AskWebRagInputZod,
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "Your question (any topic Wikipedia can answer)." },
        refresh: { type: "boolean", description: "Rebuild corpus from Wikipedia." }
      },
      required: ["question"]
    },
    requiresFhirContext: false,
    domain: "rag-web"
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

export const tools: ToolDef[] = [
  ...careGapTools,
  ...diseaseTools,
  ...carePlanTools,
  ...reportTools,
  ...diseaseMlTools,
  ...ragWebTools,
  ...manualQuestionTools
];

export { diseaseSlugToToolName };
