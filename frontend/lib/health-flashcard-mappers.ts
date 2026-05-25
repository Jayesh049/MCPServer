import type { Affirmation, CarePlan, DiseaseHit, Doctor, Exercise } from "./types";

const PALETTE = ["#f97316", "#eab308", "#06b6d4", "#ec4899", "#8b5cf6", "#22c55e", "#ef4444", "#6366f1"];

const KEYWORD_MARKER: Record<string, { name: string; value: string; status: "bad" | "warn"; note: string }> = {
  alt: { name: "ALT (Alanine Aminotransferase)", value: "Elevated", status: "bad", note: "Elevated → possible liver cell stress. Normal: 7–56 U/L" },
  ast: { name: "AST (Aspartate Aminotransferase)", value: "Elevated", status: "bad", note: "Elevated → liver or muscle injury signal. Normal: 10–40 U/L" },
  bilirubin: { name: "Bilirubin", value: "High", status: "bad", note: "May indicate bile buildup or jaundice risk" },
  cirrhosis: { name: "Cirrhosis indicators", value: "Present", status: "bad", note: "Scarring pattern mentioned — needs clinical follow-up" },
  diabetes: { name: "Diabetes keywords", value: "Detected", status: "warn", note: "Glucose/diabetes terms in report text" },
  hba1c: { name: "HbA1c", value: "Flagged", status: "warn", note: "5.7–6.4% pre-diabetes · ≥6.5% diabetes range" },
  a1c: { name: "HbA1c", value: "Flagged", status: "warn", note: "Glycemic control marker referenced in report" },
  tuberculosis: { name: "TB indicators", value: "Detected", status: "warn", note: "TB-related terms in clinical narrative" },
  tb: { name: "TB indicators", value: "Detected", status: "warn", note: "Abbreviation matched in report" },
  cad: { name: "CAD risk", value: "Detected", status: "warn", note: "Coronary artery disease terms in text" },
  ascvd: { name: "ASCVD risk", value: "Detected", status: "warn", note: "Cardiovascular risk language in report" },
  creatinine: { name: "Creatinine", value: "Elevated", status: "bad", note: "Kidney filtration marker referenced" },
  proteinuria: { name: "Proteinuria", value: "Present", status: "bad", note: "Protein in urine — kidney stress signal" }
};

const WORK_ON: Record<string, string[]> = {
  "liver-disease": [
    "Reduce alcohol and hepatotoxic supplements",
    "Low-fat, high-fiber meals",
    "Repeat liver function tests in 3 months",
    "Consult hepatology if values stay elevated"
  ],
  diabetes: [
    "Cut refined sugar and white carbs",
    "Walk 30 minutes after meals",
    "Track fasting glucose weekly",
    "Target HbA1c under 5.7% with your clinician"
  ],
  "heart-disease": [
    "DASH-style diet — less sodium, more potassium",
    "150 minutes moderate cardio per week",
    "Discuss statin therapy with cardiology",
    "Monitor blood pressure at home"
  ],
  "kidney-disease": [
    "Low sodium and moderated protein intake",
    "Tight blood pressure and glucose control",
    "Avoid NSAIDs unless prescribed",
    "Nephrology follow-up on schedule"
  ]
};

export type MarkerView = {
  name: string;
  value: string;
  status: "bad" | "warn" | "good";
  note: string;
};

export type DiseaseFlashView = {
  id: string;
  name: string;
  pct: number;
  keywords: string[];
  color: string;
  markers: MarkerView[];
  workOn: string[];
  affirmation: string;
};

export type ExerciseFlashView = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  freq: string;
  intensity: string;
  intensityColor: string;
  doctor: string;
  tip: string;
};

export type DoctorFlashView = {
  id: string;
  name: string;
  spec: string;
  hospital: string;
  yrs: number;
  exercises: string[];
  bio: string;
  approach: string;
};

export type AffirmationFlashView = {
  icon: string;
  label: string;
  text: string;
};

function colorForSlug(slug: string, index: number): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h + slug.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h + index) % PALETTE.length];
}

function exerciseIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("walk")) return "🚶";
  if (n.includes("breath") || n.includes("yoga")) return "🌬️";
  if (n.includes("stretch") || n.includes("mobil")) return "🧘";
  if (n.includes("strength")) return "💪";
  return "🏃";
}

const AFFIRMATION_ICONS: Record<string, string> = {
  presence: "✦",
  agency: "◆",
  support: "○",
  compassion: "♡",
  hope: "⊕",
  resilience: "◇",
  rest: "◌",
  trust: "★",
  celebration: "✧",
  renewal: "∞",
  strength: "★"
};

export function mapDiseaseHits(hits: DiseaseHit[], carePlan: CarePlan | null): DiseaseFlashView[] {
  const primaryAff =
    carePlan?.affirmations[0]?.statement ?? "I take one mindful step toward better health each day.";

  return hits.map((h, i) => {
    const keywords = h.evidence?.length ? h.evidence : [h.slug.replace(/-/g, " ")];
    const markers: MarkerView[] = [];
    for (const kw of keywords.slice(0, 6)) {
      const key = kw.toLowerCase().trim();
      const known = KEYWORD_MARKER[key];
      if (known) {
        markers.push(known);
      } else {
        markers.push({
          name: kw,
          value: "Matched",
          status: "warn",
          note: h.evidenceSnippets?.[0] ?? "Keyword found in extracted report text"
        });
      }
    }
    if (markers.length === 0) {
      markers.push({
        name: "Report match",
        value: `${Math.round(h.score * 100)}%`,
        status: h.score >= 0.7 ? "bad" : "warn",
        note: "Score from keyword-weighted disease matching"
      });
    }

    const workOn =
      WORK_ON[h.slug] ??
      (h.riskLevel === "high"
        ? ["Consult a specialist promptly", "Repeat labs on clinician advice", "Track symptoms daily"]
        : ["Review results with your care team", "Maintain healthy sleep and hydration", "Re-test on schedule"]);

    const affirmation =
      carePlan && h.slug === carePlan.diseaseSlug
        ? carePlan.affirmations[0]?.statement ?? primaryAff
        : primaryAff;

    return {
      id: h.slug,
      name: h.name,
      pct: Math.round(h.score * 100),
      keywords,
      color: colorForSlug(h.slug, i),
      markers,
      workOn,
      affirmation
    };
  });
}

export function mapExercises(plan: CarePlan, doctors: Doctor[]): ExerciseFlashView[] {
  const intensityColor = (level: Exercise["intensity"]) => {
    if (level === "high") return "#ef4444";
    if (level === "moderate") return "#eab308";
    return "#22c55e";
  };

  return plan.exercises.map((ex, i) => ({
    id: `${ex.name}-${i}`,
    icon: exerciseIcon(ex.name),
    name: ex.name,
    desc: ex.description,
    freq: ex.frequency,
    intensity: ex.intensity.toUpperCase(),
    intensityColor: intensityColor(ex.intensity),
    doctor: doctors[i % doctors.length]?.name ?? "Care team",
    tip: ex.cautions?.[0] ?? "Start gently and increase only if you feel well."
  }));
}

export function mapDoctors(plan: CarePlan): DoctorFlashView[] {
  return plan.topDoctors.map((doc, i) => ({
    id: `${doc.name}-${i}`,
    name: doc.name,
    spec: doc.specialty,
    hospital: `${doc.hospital.name} · ${doc.hospital.city}`,
    yrs: doc.yearsOfExperience,
    exercises: plan.exercises
      .filter((_, j) => j % plan.topDoctors.length === i)
      .map((e) => e.name)
      .slice(0, 3),
    bio: doc.bio,
    approach: doc.medications[0]?.rationale ?? doc.bio
  }));
}

export function mapAffirmations(plan: CarePlan): AffirmationFlashView[] {
  return plan.affirmations.map((a: Affirmation) => ({
    icon: AFFIRMATION_ICONS[a.theme.toLowerCase()] ?? "✨",
    label: a.theme.toUpperCase(),
    text: a.statement
  }));
}
