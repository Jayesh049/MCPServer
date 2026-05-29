import type { Affirmation, CarePlan, DiseaseHit, Doctor, Exercise } from "./types";

const PALETTE = ["#f97316", "#eab308", "#06b6d4", "#ec4899", "#8b5cf6", "#22c55e", "#ef4444", "#6366f1"];

const KEYWORD_ACRONYM: Record<string, { term: string; meaning: string }> = {
  alt: {
    term: "ALT",
    meaning:
      "Alanine aminotransferase — a liver enzyme. Elevated ALT suggests liver cell stress. Typical normal range: 7–56 U/L."
  },
  ast: {
    term: "AST",
    meaning:
      "Aspartate aminotransferase — another liver enzyme. AST/ALT ratio above 2 may suggest advanced fibrosis; near 1 may suggest fatty liver (NAFLD)."
  },
  bilirubin: {
    term: "Bilirubin",
    meaning:
      "Produced when red blood cells break down; processed by the liver. High levels may cause jaundice. Typical normal: 0.1–1.2 mg/dL."
  },
  cirrhosis: {
    term: "Cirrhosis",
    meaning: "Severe scarring of the liver. Healthy tissue is replaced by scar tissue. Progression can often be slowed with treatment."
  },
  diabetes: {
    term: "Diabetes",
    meaning: "A condition of impaired blood sugar regulation. Report text references glucose or diabetes-related terms."
  },
  hba1c: {
    term: "HbA1c",
    meaning:
      "Hemoglobin A1c — average blood sugar over 2–3 months. Above 6.5% suggests diabetes; 5.7–6.4% is prediabetes. Common T2DM target: below 7%."
  },
  a1c: {
    term: "A1c",
    meaning: "Short for HbA1c — the same test. Each 1% reduction may lower complication risk by roughly 14%."
  },
  tuberculosis: {
    term: "TB",
    meaning: "Tuberculosis — infectious disease often affecting the lungs. Clinical or imaging terms appeared in the report."
  },
  tb: { term: "TB", meaning: "Tuberculosis abbreviation matched in report text." },
  cad: {
    term: "CAD",
    meaning:
      "Coronary artery disease — plaque buildup in heart arteries. Major heart attack risk factor. Linked to BP, diabetes, LDL, and smoking."
  },
  ascvd: {
    term: "ASCVD",
    meaning:
      "Atherosclerotic cardiovascular disease — heart and vessel conditions from plaque. Ten-year ASCVD score above 7.5% often warrants statin discussion."
  },
  creatinine: {
    term: "Creatinine",
    meaning:
      "Waste from muscle metabolism filtered by kidneys. Elevated levels may mean reduced filtration. Typical normal: 0.6–1.2 mg/dL."
  },
  proteinuria: {
    term: "Proteinuria",
    meaning:
      "Protein in urine — normally protein stays in blood. Leakage suggests kidney filter damage; microalbuminuria is an early sign."
  },
  egfr: {
    term: "eGFR",
    meaning:
      "Estimated glomerular filtration rate — how well kidneys filter per minute. Normal is above 90; CKD stage 3 is 30–59. Trend matters more than a single reading."
  }
};

const WORK_ON: Record<string, string[]> = {
  "liver-disease": [
    "ALT is elevated — target below 56 U/L and recheck in 4–6 weeks.",
    "Calculate AST ÷ ALT ratio; above 2 is more serious, near 1 may suggest fatty liver.",
    "Control HbA1c, reduce refined carbs, walk 30 minutes daily for NAFLD support.",
    "If bilirubin is normal, that is reassuring — continue routine monitoring."
  ],
  diabetes: [
    "HbA1c control is the primary target — each 1% drop may reduce complications risk.",
    "Poorly controlled diabetes can worsen fatty liver — treat both together.",
    "Walk after meals and track fasting glucose weekly.",
    "Discuss targets with your clinician — typical goal under 7% for many adults."
  ],
  "heart-disease": [
    "Calculate ASCVD risk score with age, lipids, BP, diabetes, and smoking.",
    "Keep blood pressure under 130/80 mmHg — stage 2 hypertension needs prompt care.",
    "DASH-style diet and 150 minutes of moderate cardio per week.",
    "Discuss statin therapy if risk score is elevated."
  ],
  "kidney-disease": [
    "Track eGFR trend — decline over 5 mL/min/year suggests progressive CKD.",
    "Tight BP and glucose control slow CKD progression best.",
    "Low sodium, moderated protein, avoid NSAIDs unless prescribed.",
    "Nephrology follow-up every 3–6 months as advised."
  ]
};

export type AcronymView = { term: string; meaning: string };

export type WorkItemView = {
  severity: "critical" | "improve" | "ok";
  label: string;
  title: string;
  desc: string;
};

export type DiseaseFlashView = {
  id: string;
  name: string;
  pct: number;
  risk: "high" | "medium" | "low";
  keywords: string[];
  color: string;
  badge: "high" | "moderate" | "low" | "teal";
  badgeText: string;
  icon: string;
  acronyms: AcronymView[];
  work: WorkItemView[];
  affirmation: string;
};

export type ExerciseFlashView = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  freq: string;
  intensity: string;
  intensityBadge: "low" | "moderate" | "high" | "teal";
  doctorSpec: string;
  src: string;
  tip: string;
};

export type MedView = { name: string; dose: string };

export type DoctorFlashView = {
  id: string;
  name: string;
  spec: string;
  hospital: string;
  yrs: number;
  consultations: number;
  bio: string;
  meds: MedView[];
};

export type AffirmationFlashView = {
  id: string;
  sym: string;
  theme: string;
  quote: string;
};

function colorForSlug(slug: string, index: number): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h + slug.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h + index) % PALETTE.length];
}

function diseaseIcon(slug: string): string {
  if (slug.includes("liver")) return "🫀";
  if (slug.includes("diabetes")) return "💧";
  if (slug.includes("heart")) return "❤️";
  if (slug.includes("kidney")) return "🫘";
  if (slug.includes("tb") || slug.includes("tuberculosis")) return "🫁";
  return "🔬";
}

function scoreToRisk(score: number): "high" | "medium" | "low" {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function riskToBadge(risk: "high" | "medium" | "low"): { badge: DiseaseFlashView["badge"]; badgeText: string } {
  if (risk === "high") return { badge: "high", badgeText: "High risk" };
  if (risk === "medium") return { badge: "moderate", badgeText: "Medium risk" };
  return { badge: "low", badgeText: "Lower risk" };
}

function workSeverity(index: number, total: number): WorkItemView["severity"] {
  if (index === 0) return "critical";
  if (index < Math.max(2, total - 1)) return "improve";
  return "ok";
}

function workLabel(severity: WorkItemView["severity"]): string {
  if (severity === "critical") return "Critical";
  if (severity === "improve") return "Work on this";
  return "OK";
}

function exerciseIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("walk")) return "🚶";
  if (n.includes("breath") || n.includes("yoga")) return "🫁";
  if (n.includes("stretch") || n.includes("mobil")) return "🧘";
  if (n.includes("strength")) return "💪";
  return "🏃";
}

function intensityBadge(level: Exercise["intensity"]): ExerciseFlashView["intensityBadge"] {
  if (level === "high") return "high";
  if (level === "moderate") return "moderate";
  return "low";
}

const AFFIRMATION_SYMS: Record<string, string> = {
  presence: "✦",
  agency: "◈",
  support: "⬡",
  compassion: "♡",
  hope: "◎",
  resilience: "◇",
  rest: "◌",
  trust: "✧",
  celebration: "◆",
  renewal: "∞",
  strength: "★"
};

export function mapDiseaseHits(hits: DiseaseHit[], carePlan: CarePlan | null): DiseaseFlashView[] {
  const primaryAff =
    carePlan?.affirmations[0]?.statement ?? "I take one mindful step toward better health each day.";

  return hits.map((h, i) => {
    const keywords = h.evidence?.length ? h.evidence : [h.slug.replace(/-/g, " ")];
    const acronyms: AcronymView[] = [];
    for (const kw of keywords.slice(0, 6)) {
      const key = kw.toLowerCase().trim();
      const known = KEYWORD_ACRONYM[key];
      if (known) {
        acronyms.push(known);
      } else if (kw.length <= 6) {
        acronyms.push({
          term: kw.toUpperCase(),
          meaning: h.evidenceSnippets?.[0] ?? "Term matched in extracted report text."
        });
      }
    }
    if (acronyms.length === 0) {
      acronyms.push({
        term: "Match",
        meaning: `Keyword-weighted score ${Math.round(h.score * 100)}% from report analysis.`
      });
    }

    const workStrings =
      WORK_ON[h.slug] ??
      (h.riskLevel === "high"
        ? [
            "Consult a specialist promptly.",
            "Repeat labs on your clinician's advice.",
            "Track symptoms daily.",
            "Maintain sleep, hydration, and follow-up visits."
          ]
        : [
            "Review results with your care team.",
            "Keep healthy sleep and hydration habits.",
            "Re-test on the schedule your doctor recommends.",
            "Note any new symptoms between visits."
          ]);

    const work: WorkItemView[] = workStrings.map((desc, wi) => {
      const severity = workSeverity(wi, workStrings.length);
      const parts = desc.split(" — ");
      return {
        severity,
        label: workLabel(severity),
        title: parts[0]?.slice(0, 48) ?? `Focus area ${wi + 1}`,
        desc: parts[1] ?? desc
      };
    });

    const risk = scoreToRisk(h.score);
    const { badge, badgeText } = riskToBadge(risk);
    const affirmation =
      carePlan && h.slug === carePlan.diseaseSlug
        ? (carePlan.affirmations[0]?.statement ?? primaryAff)
        : primaryAff;

    return {
      id: h.slug,
      name: h.name,
      pct: Math.round(h.score * 100),
      risk,
      keywords,
      color: colorForSlug(h.slug, i),
      badge,
      badgeText,
      icon: diseaseIcon(h.slug),
      acronyms,
      work,
      affirmation
    };
  });
}

export function mapExercises(plan: CarePlan, doctors: Doctor[]): ExerciseFlashView[] {
  return plan.exercises.map((ex, i) => {
    const doc = doctors[i % Math.max(doctors.length, 1)];
    return {
      id: `${ex.name}-${i}`,
      icon: exerciseIcon(ex.name),
      name: ex.name,
      desc: ex.description,
      freq: ex.frequency,
      intensity: ex.intensity.charAt(0).toUpperCase() + ex.intensity.slice(1),
      intensityBadge: intensityBadge(ex.intensity),
      doctorSpec: doc?.specialty ?? "General practice",
      src: `${doc?.specialty ?? "Care plan"} · synthetic daily refresh`,
      tip: ex.cautions?.[0] ?? "Start gently and increase only if you feel well."
    };
  });
}

export function mapDoctors(plan: CarePlan): DoctorFlashView[] {
  return plan.topDoctors.map((doc, i) => ({
    id: `${doc.name}-${i}`,
    name: doc.name,
    spec: doc.specialty,
    hospital: `${doc.hospital.name} · ${doc.hospital.city}`,
    yrs: doc.yearsOfExperience,
    consultations: 30 + ((doc.name.length + i * 7) % 40),
    bio: doc.bio,
    meds: doc.medications.slice(0, 6).map((m) => ({
      name: m.name,
      dose: `${m.dose} · ${m.schedule}`
    }))
  }));
}

export function mapAffirmations(plan: CarePlan): AffirmationFlashView[] {
  return plan.affirmations.map((a: Affirmation, i) => ({
    id: `aff-${a.theme}-${i}`,
    sym: AFFIRMATION_SYMS[a.theme.toLowerCase()] ?? "✨",
    theme: a.theme.charAt(0).toUpperCase() + a.theme.slice(1),
    quote: a.statement
  }));
}
