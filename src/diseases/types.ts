import { z } from "zod";

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ModalitySchema = z.enum(["imaging", "clinical", "signal"]);
export type Modality = z.infer<typeof ModalitySchema>;

export const ModelKindSchema = z.enum([
  "open-source-pretrained",
  "self-trained",
  "stub"
]);
export type ModelKind = z.infer<typeof ModelKindSchema>;

export const PredictionSchema = z.object({
  classification: z.string().min(1),
  confidence: z.number().min(0).max(1),
  riskLevel: RiskLevelSchema,
  signals: z
    .array(
      z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()])
      })
    )
    .default([]),
  rationale: z.string().min(1)
});
export type Prediction = z.infer<typeof PredictionSchema>;

export const TreatmentStepSchema = z.object({
  forRiskLevel: RiskLevelSchema,
  steps: z.array(z.string().min(1))
});
export type TreatmentStep = z.infer<typeof TreatmentStepSchema>;

export const SolutionSchema = z.object({
  immediateActions: z.array(z.string()),
  followUp: z.array(z.string()),
  patientEducation: z.array(z.string())
});
export type Solution = z.infer<typeof SolutionSchema>;

export type DiseaseInputField = {
  name: string;
  label: string;
  kind: "number" | "text" | "select" | "boolean";
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
  helpText?: string;
};

export type DiseaseInputSpec =
  | { kind: "image"; acceptedMimeTypes: string[] }
  | { kind: "form"; fields: DiseaseInputField[] };

export type DiseasePredictInput = {
  imageBase64?: string;
  imageByteLength?: number;
  imageHash?: string;
  imageMimeType?: string;
  form?: Record<string, string | number | boolean>;
};

export type DiseaseConfig = {
  slug: string;
  name: string;
  category: "imaging" | "clinical" | "signal";
  modality: Modality;
  description: string;
  modelKind: ModelKind;
  modelNotes: string;
  inputSpec: DiseaseInputSpec;
  predict: (input: DiseasePredictInput) => Prediction | Promise<Prediction>;
  treatments: TreatmentStep[];
  buildSolution: (prediction: Prediction) => Solution;
};

export type DiseaseSummary = {
  slug: string;
  name: string;
  category: DiseaseConfig["category"];
  modality: Modality;
  description: string;
  modelKind: ModelKind;
  modelNotes: string;
  inputSpec: DiseaseInputSpec;
};
