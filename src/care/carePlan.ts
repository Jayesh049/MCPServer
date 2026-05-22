import { getDiseaseBySlug, listDiseases } from "../diseases/registry.js";
import {
  AFFIRMATION_POOL,
  DOCTOR_POOL,
  EXERCISE_POOL,
  GENERIC_AFFIRMATIONS,
  GENERIC_EXERCISE_POOL,
  GENERIC_MEDICATION_POOL,
  HOSPITAL_POOL,
  MEDICATION_POOL,
  type DoctorSeed,
  type ExerciseTemplate,
  type MedicationTemplate
} from "./dataPools.js";
import type { CarePlan, Doctor, Exercise, Medication } from "./types.js";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

const PREFERRED_SPECIALTIES: Record<string, string[]> = {
  "lung-cancer": ["Thoracic Oncology", "Medical Oncology", "Radiation Oncology", "Pulmonology", "Surgical Oncology"],
  "breast-cancer": ["Medical Oncology", "Surgical Oncology", "Radiation Oncology", "Internal Medicine", "Psychiatry"],
  "skin-cancer": ["Dermatology", "Medical Oncology", "Surgical Oncology", "Internal Medicine", "Psychiatry"],
  "brain-tumor": ["Neuro-oncology", "Neurology", "Radiation Oncology", "Surgical Oncology", "Psychiatry"],
  "diabetes": ["Endocrinology", "Internal Medicine", "Cardiology", "Ophthalmology", "Psychiatry"],
  "heart-disease": ["Cardiology", "Interventional Cardiology", "Internal Medicine", "Endocrinology", "Psychiatry"],
  "hypertension": ["Cardiology", "Internal Medicine", "Nephrology", "Endocrinology", "Psychiatry"],
  "kidney-disease": ["Nephrology", "Internal Medicine", "Cardiology", "Endocrinology", "Geriatric Medicine"],
  "liver-disease": ["Hepatology", "Internal Medicine", "Infectious Disease", "Geriatric Medicine", "Psychiatry"],
  "stroke": ["Neurology", "Cardiology", "Internal Medicine", "Geriatric Medicine", "Psychiatry"],
  "parkinsons": ["Neurology", "Geriatric Medicine", "Internal Medicine", "Psychiatry", "Cardiology"],
  "alzheimers": ["Neurology", "Geriatric Medicine", "Psychiatry", "Internal Medicine", "Cardiology"],
  "tuberculosis": ["Pulmonology", "Infectious Disease", "Internal Medicine", "Psychiatry", "Geriatric Medicine"],
  "covid-19": ["Pulmonology", "Infectious Disease", "Internal Medicine", "Cardiology", "Psychiatry"],
  "pneumonia": ["Pulmonology", "Infectious Disease", "Internal Medicine", "Geriatric Medicine", "Psychiatry"],
  "diabetic-retinopathy": ["Ophthalmology", "Endocrinology", "Internal Medicine", "Cardiology", "Nephrology"],
  "glaucoma": ["Ophthalmology", "Internal Medicine", "Geriatric Medicine", "Neurology", "Psychiatry"],
  "cataract": ["Ophthalmology", "Internal Medicine", "Geriatric Medicine", "Endocrinology", "Psychiatry"],
  "bone-fracture": ["Orthopedics", "Internal Medicine", "Geriatric Medicine", "Psychiatry", "Endocrinology"],
  "sleep-apnea": ["Pulmonology", "Internal Medicine", "Cardiology", "Psychiatry", "Endocrinology"]
};

function pickDoctorSeeds(slug: string, rng: () => number): DoctorSeed[] {
  const preferred = PREFERRED_SPECIALTIES[slug] ?? [];
  const chosen: DoctorSeed[] = [];
  const usedNames = new Set<string>();

  for (const spec of preferred) {
    const candidates = DOCTOR_POOL.filter(
      (d) => d.specialty === spec && !usedNames.has(d.name)
    );
    if (candidates.length === 0) continue;
    const idx = Math.floor(rng() * candidates.length);
    const pick = candidates[idx]!;
    chosen.push(pick);
    usedNames.add(pick.name);
    if (chosen.length === 5) return chosen;
  }

  // Fill remaining slots from any specialty.
  const remaining = DOCTOR_POOL.filter((d) => !usedNames.has(d.name));
  const shuffled = pickN(remaining, 5 - chosen.length, rng);
  for (const d of shuffled) {
    chosen.push(d);
    usedNames.add(d.name);
  }
  return chosen.slice(0, 5);
}

function buildMedicationsForDoctor(
  pool: MedicationTemplate[],
  count: number,
  rng: () => number
): Medication[] {
  if (pool.length === 0) return [];
  const out: Medication[] = [];
  for (let i = 0; i < count; i++) {
    const tpl = pool[i % pool.length]!;
    const dose = tpl.doseOptions[Math.floor(rng() * tpl.doseOptions.length)] ?? tpl.doseOptions[0]!;
    out.push({
      name: tpl.name,
      dose,
      schedule: tpl.schedule,
      rationale: tpl.rationale,
      cautions: tpl.cautions ?? []
    });
  }
  return out;
}

const PLAN_CACHE = new Map<string, { plan: CarePlan; cachedAt: number }>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function buildCarePlanForDate(slug: string, dateSalt: string): CarePlan {
  const disease = getDiseaseBySlug(slug);
  if (!disease) throw new Error(`Unknown disease slug: ${slug}`);

  const seed = hashStringToSeed(`careplan::${slug}::${dateSalt}`);
  const rng = mulberry32(seed);

  const exercisePool: ExerciseTemplate[] =
    EXERCISE_POOL[slug] ?? GENERIC_EXERCISE_POOL;
  const exercises: Exercise[] = exercisePool.map((e) => ({
    name: e.name,
    description: e.description,
    frequency: e.frequency,
    intensity: e.intensity,
    cautions: e.cautions ?? []
  }));

  const medPool = MEDICATION_POOL[slug] ?? GENERIC_MEDICATION_POOL;
  const doctorSeeds = pickDoctorSeeds(slug, rng);

  const topDoctors: Doctor[] = doctorSeeds.map((seedDoc, idx) => {
    const hospital = HOSPITAL_POOL[(idx + Math.floor(rng() * HOSPITAL_POOL.length)) % HOSPITAL_POOL.length]!;
    return {
      name: seedDoc.name,
      specialty: seedDoc.specialty,
      yearsOfExperience: seedDoc.yearsOfExperience,
      hospital,
      bio: seedDoc.bio,
      medications: buildMedicationsForDoctor(medPool, 10, rng)
    };
  });

  // Pad doctor list to exactly 5 if pool was thin.
  while (topDoctors.length < 5) {
    const fallback = DOCTOR_POOL[topDoctors.length % DOCTOR_POOL.length]!;
    const hospital = HOSPITAL_POOL[topDoctors.length % HOSPITAL_POOL.length]!;
    topDoctors.push({
      name: fallback.name,
      specialty: fallback.specialty,
      yearsOfExperience: fallback.yearsOfExperience,
      hospital,
      bio: fallback.bio,
      medications: buildMedicationsForDoctor(medPool, 10, rng)
    });
  }

  const affirmations = AFFIRMATION_POOL[slug] ?? GENERIC_AFFIRMATIONS;

  return {
    diseaseSlug: disease.slug,
    diseaseName: disease.name,
    synthetic: true,
    generatedAt: new Date().toISOString(),
    exercises,
    topDoctors: topDoctors.slice(0, 5) as CarePlan["topDoctors"],
    affirmations,
    disclaimers: [
      "All doctors, hospitals, and patient details shown are SYNTHETIC and fictional.",
      "Medication names are real but doses/regimens are illustrative only and NOT a clinical recommendation.",
      "Always consult a qualified clinician before starting, stopping, or changing any treatment."
    ]
  };
}

/** In-memory daily cache — plan content rotates by calendar day (YYYY-MM-DD). */
export function buildCarePlan(slug: string): CarePlan {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `${slug}::${today}`;
  const cached = PLAN_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < ONE_DAY_MS) {
    return cached.plan;
  }
  const plan = buildCarePlanForDate(slug, today);
  PLAN_CACHE.set(cacheKey, { plan, cachedAt: Date.now() });
  for (const [key, val] of PLAN_CACHE.entries()) {
    if (!key.endsWith(today) && Date.now() - val.cachedAt > ONE_DAY_MS * 2) {
      PLAN_CACHE.delete(key);
    }
  }
  return plan;
}

/**
 * Decide whether the prediction implies a "known disease" worth attaching a care plan to.
 * Anything that classifies as not-normal OR is medium/high risk qualifies.
 */
export function shouldAttachCarePlan(classification: string, riskLevel: "low" | "medium" | "high"): boolean {
  const c = classification.toLowerCase();
  const looksNormal = ["normal", "no_", "negative", "benign"].some((p) => c.startsWith(p) || c.includes(`_${p}`));
  if (looksNormal) return riskLevel === "high";
  return riskLevel === "high" || riskLevel === "medium";
}

export function listDiseaseSlugsWithCarePlan(): string[] {
  return listDiseases().map((d) => d.slug);
}
