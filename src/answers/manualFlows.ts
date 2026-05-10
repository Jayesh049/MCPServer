import { buildCarePlan } from "../care/carePlan.js";
import type { Doctor } from "../care/types.js";
import { getDiseaseBySlug } from "../diseases/registry.js";
import { analyzeReportText } from "../report/analyzeReport.js";
import { extractTextFromPdfBase64 } from "../report/pdfText.js";

const PRIMARILY_CLINIC_SLUGS = new Set([
  "lung-cancer",
  "breast-cancer",
  "skin-cancer",
  "brain-tumor",
  "stroke",
  "covid-19",
  "tuberculosis",
  "pneumonia",
  "kidney-disease",
  "liver-disease",
  "bone-fracture"
]);

function homeVsClinicNarrative(slug: string): {
  curableAtHomeAlone: boolean;
  explanation: string;
} {
  const clinic = PRIMARILY_CLINIC_SLUGS.has(slug);
  return {
    curableAtHomeAlone: false,
    explanation: clinic
      ? "This condition usually needs clinic or hospital-based diagnosis and treatment. Home measures may support recovery but do not replace specialists."
      : "Day-to-day management may include home-friendly habits under clinician guidance; confirm diagnosis and targets with a qualified doctor."
  };
}

export function answerQ2HomeRemediesThenDoctors(diseaseSlug: string) {
  const disease = getDiseaseBySlug(diseaseSlug);
  if (!disease) throw new Error(`Unknown disease slug: ${diseaseSlug}`);

  const plan = buildCarePlan(diseaseSlug);
  const { curableAtHomeAlone, explanation } = homeVsClinicNarrative(diseaseSlug);

  return {
    manualQuestionId: "q2" as const,
    manualQuestionPrompt:
      "For this disease: Is care manageable at home with remedies — then list top-level doctors (synthetic demo).",
    disease: { slug: disease.slug, name: disease.name },
    summary: {
      curableAtHomeAlone,
      homeCareGuidance: explanation,
      remedies: {
        exercises: plan.exercises,
        affirmations: plan.affirmations
      }
    },
    topDoctors: plan.topDoctors,
    disclaimers: plan.disclaimers
  };
}

const STAGE_NOTE: Record<1 | 2 | 3, string> = {
  1:
    "Early-stage framing (demo): emphasises screening confirmation, primary coordination, and preventive-focused follow-up alongside specialists.",
  2:
    "Intermediate framing (demo): emphasises active specialist-led treatment planning and closer monitoring — doctor order rotated for multidisciplinary emphasis.",
  3:
    "Advanced framing (demo): emphasises comprehensive specialist leadership — oncologic/surgical/heavy subspecialty voices surfaced earlier in the ranked list (still synthetic)."
};

function orderDoctorsForStage(doctors: Doctor[], stage: 1 | 2 | 3): Doctor[] {
  const copy = [...doctors];
  const offset = (stage - 1) % copy.length;
  return [...copy.slice(offset), ...copy.slice(0, offset)];
}

export function answerQ3DoctorsForStage(diseaseSlug: string, stage: 1 | 2 | 3) {
  const disease = getDiseaseBySlug(diseaseSlug);
  if (!disease) throw new Error(`Unknown disease slug: ${diseaseSlug}`);

  const plan = buildCarePlan(diseaseSlug);
  const doctors = orderDoctorsForStage(plan.topDoctors, stage);

  return {
    manualQuestionId: "q3" as const,
    manualQuestionPrompt:
      "For stage 1, 2, or 3: fetch doctors and show stage-adjusted priority order (synthetic demo).",
    disease: { slug: disease.slug, name: disease.name },
    stage,
    stageNote: STAGE_NOTE[stage],
    doctors,
    disclaimers: plan.disclaimers
  };
}

export async function answerQ4HealthReportDiseaseCureSolution(opts: {
  pdfText?: string;
  pdfBase64?: string;
}) {
  let text = opts.pdfText?.trim() ?? "";
  if (!text.length && opts.pdfBase64) {
    const extracted = await extractTextFromPdfBase64(opts.pdfBase64);
    text = extracted.text;
  }
  if (!text.trim()) {
    throw new Error("Provide pdfText or pdfBase64 with extractable content.");
  }

  const analysis = analyzeReportText(text);

  const disease =
    analysis.primaryDisease != null
      ? {
          slug: analysis.primaryDisease.slug,
          name: analysis.primaryDisease.name,
          matchScore: analysis.primaryDisease.score,
          evidence: analysis.primaryDisease.evidence
        }
      : null;

  const plan = analysis.carePlan;

  return {
    manualQuestionId: "q4" as const,
    manualQuestionPrompt:
      "Health report: disease, cure (supportive pathway), solution (specialists — synthetic).",
    extractedPreview: analysis.extracted.textPreview,
    disease,
    cure: plan
      ? {
          exercises: plan.exercises,
          affirmations: plan.affirmations,
          syntheticMedicationSamples: plan.topDoctors.map((d) => ({
            doctorName: d.name,
            specialty: d.specialty,
            sampleMedications: d.medications.slice(0, 4)
          }))
        }
      : null,
    solution: plan
      ? {
          topDoctors: plan.topDoctors
        }
      : null,
    detectedDiseases: analysis.detectedDiseases,
    notes: analysis.notes,
    disclaimers: plan?.disclaimers ?? [
      "Synthetic demo only. Not a diagnosis or treatment plan.",
      "Do not upload PHI."
    ]
  };
}
