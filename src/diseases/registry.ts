import type { DiseaseConfig, DiseaseSummary } from "./types.js";
import {
  bandToRiskLevel,
  bool,
  buildGenericSolution,
  deterministicScoreFromImage,
  getTreatmentSteps,
  num,
  str
} from "./helpers.js";
import { predictPneumonia } from "./predictors/pneumoniaHF.js";
import { predictDiabetesLR } from "./predictors/diabetesLR.js";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

function imagingPredictor(opts: {
  positiveLabel: string;
  negativeLabel: string;
  rationaleBase: string;
}) {
  return (input: Parameters<DiseaseConfig["predict"]>[0]) => {
    const score = deterministicScoreFromImage(input);
    const riskLevel = bandToRiskLevel(score);
    const positive = score >= 0.5;
    return {
      classification: positive ? opts.positiveLabel : opts.negativeLabel,
      confidence: Math.abs(score - 0.5) * 2,
      riskLevel,
      signals: [
        { label: "Imaging-derived risk score", value: Number(score.toFixed(3)) },
        {
          label: "Image bytes received",
          value: input.imageByteLength ?? 0
        }
      ],
      rationale:
        `${opts.rationaleBase} Deterministic stub uses an image-hash-based risk score ` +
        `for safe synthetic-data testing (no PHI).`
    };
  };
}

const PATIENT_ED_GENERIC = [
  "Discuss findings with your clinician before changing any treatment.",
  "Bring a list of current medications and recent labs/imaging to your next visit.",
  "Avoid self-diagnosis; this tool is for decision-support and education only."
];

export const diseases: DiseaseConfig[] = [
  // ---------- 1. Brain tumor (MRI) ----------
  {
    slug: "brain-tumor",
    name: "Brain tumor (MRI)",
    category: "imaging",
    modality: "imaging",
    description:
      "Detect likely tumor-vs-no-tumor patterns from a brain MRI image (synthetic test only).",
    modelKind: "open-source-pretrained",
    modelNotes:
      "Will wrap a pretrained MRI tumor classifier (e.g., HuggingFace model) in production.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "tumor_likely",
      negativeLabel: "no_tumor_detected",
      rationaleBase: "Brain tumor detection from MRI."
    }),
    treatments: [
      {
        forRiskLevel: "low",
        steps: [
          "No imaging features suggesting tumor; continue routine surveillance.",
          "Reassess if new neurological symptoms appear."
        ]
      },
      {
        forRiskLevel: "medium",
        steps: [
          "Refer for neurology evaluation.",
          "Consider repeat MRI with contrast within 4-6 weeks."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Urgent neurology / neurosurgery referral.",
          "Order contrast-enhanced MRI; consider stereotactic biopsy planning."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Track and report new neurological symptoms (severe headaches, vision changes, weakness).",
        "Avoid driving if symptoms are unstable.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 2. Pneumonia (CXR) ----------
  {
    slug: "pneumonia",
    name: "Pneumonia (chest X-ray)",
    category: "imaging",
    modality: "imaging",
    description: "Identify likely pneumonia patterns from a chest X-ray image.",
    modelKind: "open-source-pretrained",
    modelNotes:
      "Calls a HuggingFace Inference API model (default: lxyuan/vit-xray-pneumonia-classification). " +
      "Falls back to a deterministic image-hash score when HF_API_TOKEN is not set.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: predictPneumonia,
    treatments: [
      { forRiskLevel: "low", steps: ["No active infiltrates suggested. Routine care."] },
      {
        forRiskLevel: "medium",
        steps: [
          "Clinical correlation; consider sputum culture and CBC.",
          "Empiric oral antibiotics if clinically consistent with CAP."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Urgent clinical review; assess oxygenation and severity score (CURB-65).",
          "Consider hospitalization if hypoxic or hemodynamically unstable."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Watch for fever, productive cough, shortness of breath; seek care if worsening.",
        "Stay hydrated and rest; complete any prescribed antibiotic course.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 3. Tuberculosis ----------
  {
    slug: "tuberculosis",
    name: "Tuberculosis (chest X-ray)",
    category: "imaging",
    modality: "imaging",
    description: "Screen chest X-ray for findings suggestive of tuberculosis.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap a TB screening classifier.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "tb_findings_suspected",
      negativeLabel: "no_tb_findings",
      rationaleBase: "Tuberculosis screening from CXR."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["No findings suggesting TB. Routine follow-up."] },
      {
        forRiskLevel: "medium",
        steps: [
          "Order sputum AFB smear and Xpert MTB/RIF.",
          "Implement airborne isolation precautions if symptoms present."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Initiate isolation; refer to TB / infectious diseases service.",
          "Arrange contact tracing and public-health notification per local rules."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Watch for chronic cough (>2 weeks), weight loss, night sweats, hemoptysis.",
        "Cover mouth when coughing; seek care promptly if symptomatic.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 4. COVID-19 ----------
  {
    slug: "covid-19",
    name: "COVID-19 (chest X-ray)",
    category: "imaging",
    modality: "imaging",
    description: "Identify radiographic findings suggestive of COVID-19 pneumonia.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap an open COVID-CXR classifier.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "covid_findings",
      negativeLabel: "no_covid_findings",
      rationaleBase: "COVID-19 imaging finding detection."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["No suggestive findings; consider PCR if symptomatic."] },
      {
        forRiskLevel: "medium",
        steps: [
          "Confirmatory PCR/antigen testing.",
          "Symptomatic management; monitor SpO2 at home."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Clinical evaluation for hypoxia and need for hospitalization.",
          "Consider antivirals per current guidelines for high-risk patients."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Isolate while symptomatic; wear a well-fitting mask around others.",
        "Seek urgent care if shortness of breath or persistent chest pain.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 5. Skin cancer (melanoma) ----------
  {
    slug: "skin-cancer",
    name: "Skin lesion (dermatology image)",
    category: "imaging",
    modality: "imaging",
    description: "Classify a dermatology image as benign vs likely malignant.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap an HAM10000-style classifier.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "lesion_likely_malignant",
      negativeLabel: "lesion_likely_benign",
      rationaleBase: "Dermatology lesion classification."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["Likely benign; continue self-monitoring (ABCDE)."] },
      { forRiskLevel: "medium", steps: ["Schedule dermatology evaluation within 2-4 weeks."] },
      {
        forRiskLevel: "high",
        steps: [
          "Refer to dermatology urgently for dermoscopy and possible biopsy.",
          "Document size and photographs for tracking."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Check skin monthly using ABCDE rule (Asymmetry, Border, Color, Diameter, Evolving).",
        "Use sun protection (SPF 30+, reapply every 2 hours).",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 6. Diabetic retinopathy ----------
  {
    slug: "diabetic-retinopathy",
    name: "Diabetic retinopathy (retina image)",
    category: "imaging",
    modality: "imaging",
    description: "Grade diabetic retinopathy severity from a retinal image.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap an APTOS-style DR classifier.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: (input) => {
      const score = deterministicScoreFromImage(input);
      const grade =
        score < 0.2
          ? "no_DR"
          : score < 0.4
            ? "mild_NPDR"
            : score < 0.6
              ? "moderate_NPDR"
              : score < 0.8
                ? "severe_NPDR"
                : "proliferative_DR";
      const risk = bandToRiskLevel(score);
      return {
        classification: grade,
        confidence: Math.min(1, 0.5 + Math.abs(score - 0.5)),
        riskLevel: risk,
        signals: [{ label: "Severity score", value: Number(score.toFixed(3)) }],
        rationale:
          "Diabetic retinopathy graded into 5 levels (none/mild/moderate/severe/proliferative)."
      };
    },
    treatments: [
      {
        forRiskLevel: "low",
        steps: [
          "Maintain glycemic control; retina exam every 12 months.",
          "Reinforce smoking cessation and BP control."
        ]
      },
      {
        forRiskLevel: "medium",
        steps: [
          "Retinal specialist follow-up within 3-6 months.",
          "Reassess A1c, BP, lipids and tighten control."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Urgent ophthalmology referral.",
          "Consider anti-VEGF therapy or photocoagulation per specialist decision."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Tight glycemic control reduces progression of retinopathy.",
        "Manage hypertension and lipids; avoid smoking.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 7. Glaucoma ----------
  {
    slug: "glaucoma",
    name: "Glaucoma (retina image)",
    category: "imaging",
    modality: "imaging",
    description: "Identify optic-disc patterns suggestive of glaucoma.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap an open glaucoma classifier (REFUGE / ACRIMA).",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "glaucoma_suspected",
      negativeLabel: "no_glaucoma_findings",
      rationaleBase: "Glaucoma classification from fundus image."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["No glaucoma features; continue routine eye exams."] },
      { forRiskLevel: "medium", steps: ["Ophthalmology referral; consider OCT and IOP measurement."] },
      {
        forRiskLevel: "high",
        steps: [
          "Urgent ophthalmology evaluation.",
          "Initiate IOP-lowering therapy per specialist."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Annual eye exam after age 40; earlier with family history.",
        "Adhere to prescribed eye drops and follow-up schedule.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 8. Cataract ----------
  {
    slug: "cataract",
    name: "Cataract (eye image)",
    category: "imaging",
    modality: "imaging",
    description: "Detect cataract findings from an external eye / fundus image.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap an open cataract classifier.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "cataract_likely",
      negativeLabel: "no_cataract_findings",
      rationaleBase: "Cataract detection from eye image."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["No cataract findings; routine review."] },
      { forRiskLevel: "medium", steps: ["Optometry/ophthalmology evaluation; assess visual impact."] },
      {
        forRiskLevel: "high",
        steps: [
          "Refer for surgical evaluation.",
          "Discuss IOL options and pre-op assessment."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Watch for blurry, faded vision and difficulty with night driving.",
        "Use UV-protective eyewear; manage diabetes if present.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 9. Breast cancer (mammogram) ----------
  {
    slug: "breast-cancer",
    name: "Breast cancer (mammogram)",
    category: "imaging",
    modality: "imaging",
    description: "Classify mammogram regions as benign vs likely malignant.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap an open mammography classifier.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "mass_suspicious",
      negativeLabel: "benign_or_normal",
      rationaleBase: "Mammographic finding classification."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["Continue routine screening per age-based guideline."] },
      { forRiskLevel: "medium", steps: ["Diagnostic mammography +/- ultrasound."] },
      {
        forRiskLevel: "high",
        steps: [
          "Urgent referral for tissue sampling (core biopsy).",
          "Multidisciplinary review (breast clinic) for staging if confirmed."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Adhere to screening schedule; report new lumps or skin changes.",
        "Discuss family history; consider genetic counseling if high risk.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 10. Lung cancer (CT) ----------
  {
    slug: "lung-cancer",
    name: "Lung cancer (CT)",
    category: "imaging",
    modality: "imaging",
    description: "Detect suspicious lung nodules on chest CT.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap a Lung-Nodule classifier (LIDC-IDRI based).",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "nodule_suspicious",
      negativeLabel: "no_suspicious_nodule",
      rationaleBase: "Pulmonary nodule classification."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["Routine surveillance per Fleischner guidelines."] },
      { forRiskLevel: "medium", steps: ["Short-interval follow-up CT in 3-6 months."] },
      {
        forRiskLevel: "high",
        steps: [
          "Refer to pulmonology / thoracic oncology.",
          "Consider PET-CT and tissue sampling per local pathway."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Smoking cessation reduces progression risk.",
        "Annual low-dose CT for eligible high-risk patients.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 11. Bone fracture ----------
  {
    slug: "bone-fracture",
    name: "Bone fracture (X-ray)",
    category: "imaging",
    modality: "imaging",
    description: "Detect fractures on extremity X-rays.",
    modelKind: "open-source-pretrained",
    modelNotes: "Will wrap an open MURA-style fracture classifier.",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "fracture_detected",
      negativeLabel: "no_fracture",
      rationaleBase: "Fracture detection on plain radiograph."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["No acute fracture; symptomatic care if pain present."] },
      { forRiskLevel: "medium", steps: ["Splinting / orthopedic outpatient review."] },
      {
        forRiskLevel: "high",
        steps: [
          "Immobilize and arrange urgent orthopedic care.",
          "Consider CT for complex/articular fractures."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Rest, ice, compression, elevation as appropriate.",
        "Watch for compartment-syndrome signs (pain out of proportion, numbness).",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 12. Alzheimer's ----------
  {
    slug: "alzheimers",
    name: "Alzheimer's (brain MRI)",
    category: "imaging",
    modality: "imaging",
    description:
      "Identify atrophy patterns suggestive of Alzheimer's disease from brain MRI.",
    modelKind: "self-trained",
    modelNotes: "Self-trained CNN on synthetic atrophy patterns (placeholder).",
    inputSpec: { kind: "image", acceptedMimeTypes: IMAGE_MIMES },
    predict: imagingPredictor({
      positiveLabel: "atrophy_pattern_suggestive",
      negativeLabel: "no_atrophy_pattern",
      rationaleBase: "Alzheimer's disease screening from brain MRI."
    }),
    treatments: [
      { forRiskLevel: "low", steps: ["No suggestive atrophy; cognitive monitoring at routine visits."] },
      { forRiskLevel: "medium", steps: ["Refer to memory clinic; full neuropsych assessment."] },
      {
        forRiskLevel: "high",
        steps: [
          "Specialist neurology evaluation.",
          "Discuss cognitive enhancers and caregiver support."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Engage in cognitive activities and physical exercise.",
        "Caregivers: plan for safety, finances, and advance directives.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 13. Diabetes ----------
  {
    slug: "diabetes",
    name: "Diabetes risk (clinical)",
    category: "clinical",
    modality: "clinical",
    description: "Risk-stratify type-2 diabetes from clinical features.",
    modelKind: "self-trained",
    modelNotes:
      "Self-trained logistic regression in pure TypeScript on a synthetic dataset. " +
      "Run `npm run train:diabetes` to (re)build `src/diseases/models/diabetes-lr.json`.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "age", label: "Age", kind: "number", min: 1, max: 120, required: true },
        { name: "bmi", label: "BMI", kind: "number", min: 10, max: 60, required: true },
        { name: "fastingGlucose", label: "Fasting glucose", kind: "number", unit: "mg/dL" },
        { name: "a1c", label: "HbA1c", kind: "number", unit: "%", helpText: "Optional" },
        { name: "familyHistory", label: "Family history of diabetes", kind: "boolean" }
      ]
    },
    predict: predictDiabetesLR,
    treatments: [
      { forRiskLevel: "low", steps: ["Lifestyle counseling; rescreen in 3 years."] },
      { forRiskLevel: "medium", steps: ["Initiate intensive lifestyle program; rescreen in 1 year."] },
      {
        forRiskLevel: "high",
        steps: [
          "Confirm with repeat A1c/fasting glucose; initiate metformin if confirmed.",
          "Refer for diabetes education and optometry baseline."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Aim for 5-7% body weight reduction if overweight.",
        "150 minutes/week of moderate aerobic activity.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 14. Heart disease ----------
  {
    slug: "heart-disease",
    name: "Heart disease risk (clinical)",
    category: "clinical",
    modality: "clinical",
    description: "Estimate ASCVD-style heart disease risk from clinical inputs.",
    modelKind: "self-trained",
    modelNotes: "Self-trained logistic-style scoring on synthetic features.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "age", label: "Age", kind: "number", required: true },
        { name: "sex", label: "Sex", kind: "select", options: ["male", "female"] },
        { name: "totalCholesterol", label: "Total cholesterol", kind: "number", unit: "mg/dL" },
        { name: "hdl", label: "HDL", kind: "number", unit: "mg/dL" },
        { name: "systolicBp", label: "Systolic BP", kind: "number", unit: "mmHg" },
        { name: "smoker", label: "Current smoker", kind: "boolean" },
        { name: "diabetic", label: "Diabetic", kind: "boolean" }
      ]
    },
    predict: (input) => {
      const f = input.form ?? {};
      let score = 0;
      score += Math.max(0, num(f, "age") - 40) / 80;
      score += Math.max(0, num(f, "totalCholesterol") - 200) / 200;
      score += Math.max(0, num(f, "systolicBp") - 120) / 80;
      if (bool(f, "smoker")) score += 0.15;
      if (bool(f, "diabetic")) score += 0.15;
      score -= Math.max(0, num(f, "hdl") - 40) / 200;
      score = Math.max(0, Math.min(1, score));

      const risk = bandToRiskLevel(score);
      return {
        classification:
          score >= 0.66 ? "high_ascvd_risk" : score >= 0.33 ? "moderate_risk" : "low_risk",
        confidence: 0.65,
        riskLevel: risk,
        signals: [
          { label: "Age", value: num(f, "age") },
          { label: "SBP", value: num(f, "systolicBp") },
          { label: "Total chol / HDL", value: `${num(f, "totalCholesterol")} / ${num(f, "hdl")}` }
        ],
        rationale:
          "Synthetic ASCVD-style scoring on age, lipids, BP, smoking, and diabetes."
      };
    },
    treatments: [
      { forRiskLevel: "low", steps: ["Lifestyle reinforcement; reassess in 4-6 years."] },
      {
        forRiskLevel: "medium",
        steps: [
          "Lifestyle plus consider moderate-intensity statin per shared decision.",
          "BP target <130/80 if hypertensive."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Initiate high-intensity statin per guidelines.",
          "Aggressive BP and glycemic control; cardiology consult if appropriate."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Mediterranean-style diet; reduce sodium and saturated fats.",
        "Smoking cessation has the largest single impact on risk.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 15. Kidney disease ----------
  {
    slug: "kidney-disease",
    name: "Chronic kidney disease (clinical)",
    category: "clinical",
    modality: "clinical",
    description: "Stage CKD from creatinine, eGFR, and proteinuria signals.",
    modelKind: "self-trained",
    modelNotes: "Synthetic CKD staging based on KDIGO categories.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "egfr", label: "eGFR", kind: "number", unit: "mL/min/1.73m²" },
        { name: "creatinine", label: "Serum creatinine", kind: "number", unit: "mg/dL" },
        { name: "uacr", label: "Urine ACR", kind: "number", unit: "mg/g" }
      ]
    },
    predict: (input) => {
      const f = input.form ?? {};
      const egfr = num(f, "egfr");
      const uacr = num(f, "uacr");
      let stage = "G1";
      if (egfr >= 90) stage = "G1";
      else if (egfr >= 60) stage = "G2";
      else if (egfr >= 45) stage = "G3a";
      else if (egfr >= 30) stage = "G3b";
      else if (egfr >= 15) stage = "G4";
      else stage = "G5";

      const score =
        egfr >= 90 ? 0.1 : egfr >= 60 ? 0.3 : egfr >= 30 ? 0.6 : 0.9;
      const adj = score + (uacr >= 300 ? 0.1 : uacr >= 30 ? 0.05 : 0);
      const finalScore = Math.min(1, adj);
      return {
        classification: `ckd_${stage.toLowerCase()}`,
        confidence: 0.8,
        riskLevel: bandToRiskLevel(finalScore),
        signals: [
          { label: "eGFR", value: egfr },
          { label: "UACR", value: uacr }
        ],
        rationale: "Synthetic KDIGO-style staging."
      };
    },
    treatments: [
      { forRiskLevel: "low", steps: ["Annual eGFR/UACR; manage BP and glucose."] },
      {
        forRiskLevel: "medium",
        steps: [
          "ACEi/ARB if albuminuria; review nephrotoxic medications.",
          "Tighter BP/glucose control."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Nephrology referral.",
          "Discuss kidney replacement therapy planning if eGFR <20."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Hydration and avoidance of NSAIDs and contrast unless necessary.",
        "Monitor potassium and sodium intake per dietitian guidance.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 16. Liver disease ----------
  {
    slug: "liver-disease",
    name: "Liver disease (clinical)",
    category: "clinical",
    modality: "clinical",
    description: "Detect concerning liver-function patterns from labs.",
    modelKind: "self-trained",
    modelNotes: "Synthetic rule-based scoring on AST/ALT/Bilirubin/Albumin.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "alt", label: "ALT", kind: "number", unit: "U/L" },
        { name: "ast", label: "AST", kind: "number", unit: "U/L" },
        { name: "bilirubin", label: "Total bilirubin", kind: "number", unit: "mg/dL" },
        { name: "albumin", label: "Albumin", kind: "number", unit: "g/dL" }
      ]
    },
    predict: (input) => {
      const f = input.form ?? {};
      const alt = num(f, "alt");
      const ast = num(f, "ast");
      const bili = num(f, "bilirubin");
      const alb = num(f, "albumin");
      let score = 0;
      if (alt > 80 || ast > 80) score += 0.4;
      else if (alt > 40 || ast > 40) score += 0.2;
      if (bili > 1.2) score += 0.3;
      if (alb && alb < 3.5) score += 0.3;
      score = Math.min(1, score);
      return {
        classification:
          score >= 0.6 ? "liver_dysfunction" : score >= 0.3 ? "borderline" : "normal_liver_panel",
        confidence: 0.7,
        riskLevel: bandToRiskLevel(score),
        signals: [
          { label: "ALT", value: alt },
          { label: "AST", value: ast },
          { label: "Bilirubin", value: bili },
          { label: "Albumin", value: alb }
        ],
        rationale: "Rule-based scoring on liver enzymes, bilirubin, albumin."
      };
    },
    treatments: [
      { forRiskLevel: "low", steps: ["Routine monitoring; lifestyle reinforcement."] },
      {
        forRiskLevel: "medium",
        steps: [
          "Repeat LFTs in 4-8 weeks; review medications and alcohol use.",
          "Consider US abdomen if persistently abnormal."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Hepatology referral; viral hepatitis screen.",
          "Avoid hepatotoxic agents and alcohol."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Avoid alcohol; review acetaminophen dosing carefully.",
        "Vaccinate for hepatitis A/B if indicated.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 17. Stroke ----------
  {
    slug: "stroke",
    name: "Stroke risk (clinical)",
    category: "clinical",
    modality: "clinical",
    description: "Estimate stroke risk from age/AFib/BP/smoking.",
    modelKind: "self-trained",
    modelNotes: "CHA2DS2-VASc-style synthetic scoring.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "age", label: "Age", kind: "number", required: true },
        { name: "afib", label: "Atrial fibrillation", kind: "boolean" },
        { name: "hypertension", label: "Hypertension", kind: "boolean" },
        { name: "diabetes", label: "Diabetes", kind: "boolean" },
        { name: "priorStroke", label: "Prior stroke / TIA", kind: "boolean" },
        { name: "smoker", label: "Current smoker", kind: "boolean" }
      ]
    },
    predict: (input) => {
      const f = input.form ?? {};
      let score = 0;
      const age = num(f, "age");
      if (age >= 75) score += 0.3;
      else if (age >= 65) score += 0.15;
      if (bool(f, "afib")) score += 0.2;
      if (bool(f, "hypertension")) score += 0.1;
      if (bool(f, "diabetes")) score += 0.1;
      if (bool(f, "priorStroke")) score += 0.3;
      if (bool(f, "smoker")) score += 0.1;
      score = Math.min(1, score);

      return {
        classification:
          score >= 0.66 ? "high_stroke_risk" : score >= 0.33 ? "moderate_risk" : "low_risk",
        confidence: 0.7,
        riskLevel: bandToRiskLevel(score),
        signals: [
          { label: "Age", value: age },
          { label: "AFib", value: bool(f, "afib") ? 1 : 0 },
          { label: "Prior stroke", value: bool(f, "priorStroke") ? 1 : 0 }
        ],
        rationale: "CHA2DS2-VASc-style synthetic risk scoring."
      };
    },
    treatments: [
      { forRiskLevel: "low", steps: ["Lifestyle measures; BP and glucose control."] },
      {
        forRiskLevel: "medium",
        steps: [
          "BP target <130/80; consider statin and antiplatelet per guidelines.",
          "If AFib: consider anticoagulation per CHA2DS2-VASc."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Initiate anticoagulation if AFib (no contraindication).",
          "Aggressive BP and lipid management; neurology referral if symptomatic."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Recognize FAST symptoms (Face, Arm, Speech, Time).",
        "Adhere to anticoagulation if prescribed; avoid abrupt BP drops.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 18. Hypertension control ----------
  {
    slug: "hypertension",
    name: "Hypertension control",
    category: "clinical",
    modality: "clinical",
    description: "Assess BP control level using recent systolic/diastolic readings.",
    modelKind: "self-trained",
    modelNotes: "Rule-based per JNC8/ACC-AHA stages.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "systolic", label: "Systolic BP", kind: "number", unit: "mmHg", required: true },
        { name: "diastolic", label: "Diastolic BP", kind: "number", unit: "mmHg", required: true },
        { name: "ageOver60", label: "Age >60", kind: "boolean" }
      ]
    },
    predict: (input) => {
      const f = input.form ?? {};
      const sbp = num(f, "systolic");
      const dbp = num(f, "diastolic");
      let cls = "normal";
      if (sbp >= 180 || dbp >= 120) cls = "stage_3_crisis";
      else if (sbp >= 140 || dbp >= 90) cls = "stage_2";
      else if (sbp >= 130 || dbp >= 80) cls = "stage_1";
      else if (sbp >= 120) cls = "elevated";
      const score =
        cls === "stage_3_crisis"
          ? 1
          : cls === "stage_2"
            ? 0.8
            : cls === "stage_1"
              ? 0.5
              : cls === "elevated"
                ? 0.3
                : 0.1;
      return {
        classification: cls,
        confidence: 0.85,
        riskLevel: bandToRiskLevel(score),
        signals: [
          { label: "SBP", value: sbp },
          { label: "DBP", value: dbp }
        ],
        rationale: "Stage classification per common BP guidelines."
      };
    },
    treatments: [
      { forRiskLevel: "low", steps: ["Lifestyle reinforcement; rescreen annually."] },
      {
        forRiskLevel: "medium",
        steps: [
          "Lifestyle + initiate first-line agent (thiazide, ACEi/ARB or CCB).",
          "Home BP monitoring; recheck in 4 weeks."
        ]
      },
      {
        forRiskLevel: "high",
        steps: [
          "Combination therapy.",
          "If BP >=180/120 with symptoms: urgent evaluation for hypertensive emergency."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "DASH diet, reduced sodium (<1500-2300 mg/day).",
        "Regular aerobic activity 150 min/week; limit alcohol.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 19. Parkinson's ----------
  {
    slug: "parkinsons",
    name: "Parkinson's (voice/signal features)",
    category: "signal",
    modality: "signal",
    description: "Predict Parkinson's risk from synthetic voice-feature inputs.",
    modelKind: "self-trained",
    modelNotes: "Synthetic logistic-style scoring on jitter/shimmer/HNR.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "jitter", label: "Voice jitter (%)", kind: "number" },
        { name: "shimmer", label: "Voice shimmer (%)", kind: "number" },
        { name: "hnr", label: "Harmonics-to-noise ratio (dB)", kind: "number" },
        { name: "tremorReported", label: "Resting tremor reported", kind: "boolean" }
      ]
    },
    predict: (input) => {
      const f = input.form ?? {};
      let score = 0;
      score += Math.min(0.4, num(f, "jitter") / 5);
      score += Math.min(0.3, num(f, "shimmer") / 10);
      score += Math.max(0, (20 - num(f, "hnr")) / 40);
      if (bool(f, "tremorReported")) score += 0.2;
      score = Math.max(0, Math.min(1, score));

      return {
        classification:
          score >= 0.66
            ? "parkinsonism_likely"
            : score >= 0.33
              ? "uncertain_signal"
              : "low_signal",
        confidence: 0.6,
        riskLevel: bandToRiskLevel(score),
        signals: [
          { label: "Jitter", value: num(f, "jitter") },
          { label: "Shimmer", value: num(f, "shimmer") },
          { label: "HNR", value: num(f, "hnr") }
        ],
        rationale: "Heuristic on voice acoustic signals + reported tremor."
      };
    },
    treatments: [
      { forRiskLevel: "low", steps: ["No further action; reassess if motor symptoms appear."] },
      { forRiskLevel: "medium", steps: ["Refer to neurology for in-person assessment."] },
      {
        forRiskLevel: "high",
        steps: [
          "Movement-disorder neurology referral.",
          "Discuss medication initiation (levodopa, dopamine agonists) per specialist."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Regular physical exercise can slow motor decline.",
        "Speech and physical therapy referrals as symptoms progress.",
        ...PATIENT_ED_GENERIC
      ])
  },

  // ---------- 20. Sleep apnea ----------
  {
    slug: "sleep-apnea",
    name: "Sleep apnea risk (questionnaire)",
    category: "signal",
    modality: "signal",
    description: "STOP-BANG-style questionnaire risk estimate for OSA.",
    modelKind: "self-trained",
    modelNotes: "Rule-based STOP-BANG scoring.",
    inputSpec: {
      kind: "form",
      fields: [
        { name: "snoring", label: "Loud snoring", kind: "boolean" },
        { name: "tired", label: "Tired during day", kind: "boolean" },
        { name: "observedApnea", label: "Observed apnea", kind: "boolean" },
        { name: "highBp", label: "High blood pressure", kind: "boolean" },
        { name: "bmiOver35", label: "BMI > 35", kind: "boolean" },
        { name: "ageOver50", label: "Age > 50", kind: "boolean" },
        { name: "neckOver40cm", label: "Neck circumference > 40 cm", kind: "boolean" },
        { name: "male", label: "Male sex", kind: "boolean" }
      ]
    },
    predict: (input) => {
      const f = input.form ?? {};
      const items = [
        "snoring",
        "tired",
        "observedApnea",
        "highBp",
        "bmiOver35",
        "ageOver50",
        "neckOver40cm",
        "male"
      ];
      const yes = items.filter((k) => bool(f, k)).length;
      const score = yes / items.length;
      const cls =
        yes >= 5 ? "high_risk_osa" : yes >= 3 ? "intermediate_risk_osa" : "low_risk_osa";
      return {
        classification: cls,
        confidence: 0.75,
        riskLevel: bandToRiskLevel(score),
        signals: [{ label: "STOP-BANG yes-count", value: yes }],
        rationale: "STOP-BANG yes-count thresholds for OSA risk stratification."
      };
    },
    treatments: [
      { forRiskLevel: "low", steps: ["Sleep hygiene; reassess if symptoms develop."] },
      { forRiskLevel: "medium", steps: ["Refer for home sleep apnea testing."] },
      {
        forRiskLevel: "high",
        steps: [
          "In-lab polysomnography.",
          "Initiate CPAP if confirmed; weight management."
        ]
      }
    ],
    buildSolution: (p) =>
      buildGenericSolution(p, [
        "Avoid alcohol/sedatives near bedtime; sleep on side.",
        "Weight loss reduces severity in many patients.",
        ...PATIENT_ED_GENERIC
      ])
  }
];

export function listDiseases(): DiseaseSummary[] {
  return diseases.map((d) => ({
    slug: d.slug,
    name: d.name,
    category: d.category,
    modality: d.modality,
    description: d.description,
    modelKind: d.modelKind,
    modelNotes: d.modelNotes,
    inputSpec: d.inputSpec
  }));
}

export function getDiseaseBySlug(slug: string): DiseaseConfig | undefined {
  return diseases.find((d) => d.slug === slug);
}

export async function runDiseasePipeline(
  slug: string,
  input: Parameters<DiseaseConfig["predict"]>[0]
) {
  const config = getDiseaseBySlug(slug);
  if (!config) throw new Error(`Unknown disease slug: ${slug}`);
  const prediction = await Promise.resolve(config.predict(input));
  const resolutionSteps = getTreatmentSteps(config.treatments, prediction.riskLevel);
  const solution = config.buildSolution(prediction);
  return {
    disease: { slug: config.slug, name: config.name },
    detection: prediction,
    resolution: {
      forRiskLevel: prediction.riskLevel,
      steps: resolutionSteps
    },
    solution
  };
}
