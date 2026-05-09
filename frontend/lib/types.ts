export type Modality = "imaging" | "clinical" | "signal";
export type RiskLevel = "low" | "medium" | "high";
export type ModelKind = "open-source-pretrained" | "self-trained" | "stub";

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

export type DiseaseSummary = {
  slug: string;
  name: string;
  category: "imaging" | "clinical" | "signal";
  modality: Modality;
  description: string;
  modelKind: ModelKind;
  modelNotes: string;
  inputSpec: DiseaseInputSpec;
};

export type Prediction = {
  classification: string;
  confidence: number;
  riskLevel: RiskLevel;
  signals: { label: string; value: string | number }[];
  rationale: string;
};

export type Resolution = {
  forRiskLevel: RiskLevel;
  steps: string[];
};

export type Solution = {
  immediateActions: string[];
  followUp: string[];
  patientEducation: string[];
};

export type Exercise = {
  name: string;
  description: string;
  frequency: string;
  intensity: "low" | "moderate" | "high";
  cautions: string[];
};

export type Medication = {
  name: string;
  dose: string;
  schedule: string;
  rationale: string;
  cautions: string[];
};

export type Hospital = {
  name: string;
  city: string;
  country: string;
};

export type Doctor = {
  name: string;
  specialty: string;
  yearsOfExperience: number;
  hospital: Hospital;
  bio: string;
  medications: Medication[];
};

export type Affirmation = {
  theme: string;
  statement: string;
};

export type CarePlan = {
  diseaseSlug: string;
  diseaseName: string;
  synthetic: true;
  generatedAt: string;
  exercises: Exercise[];
  topDoctors: Doctor[];
  affirmations: Affirmation[];
  disclaimers: string[];
};

export type DiseasePipelineResult = {
  disease: { slug: string; name: string };
  detection: Prediction;
  resolution: Resolution;
  solution: Solution;
  carePlan?: CarePlan | null;
};

export type DiseaseHit = {
  slug: string;
  name: string;
  score: number;
  evidence: string[];
  evidenceSnippets: string[];
};

export type ReportAnalysisResult = {
  input?: { kind: "pdf" | "text" | "xlsx" | "csv"; filename?: string; pages?: number };
  extracted: { pages?: number; textPreview: string; charCount: number };
  detectedDiseases: DiseaseHit[];
  primaryDisease: DiseaseHit | null;
  carePlan: CarePlan | null;
  notes: string[];
};
