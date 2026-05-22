const ICONS: Record<string, string> = {
  "brain-tumor": "🧠",
  pneumonia: "🫁",
  tuberculosis: "🔬",
  "covid-19": "🦠",
  "skin-cancer": "🔬",
  "diabetic-retinopathy": "👁",
  glaucoma: "👁",
  cataract: "👁",
  "breast-cancer": "🎗",
  "lung-cancer": "🫁",
  "bone-fracture": "🦴",
  alzheimers: "🧠",
  diabetes: "🩸",
  "heart-disease": "❤️",
  "kidney-disease": "🫘",
  "liver-disease": "🍃",
  hypertension: "💊",
  stroke: "⚡",
  parkinsons: "🧠",
  "sleep-apnea": "😴"
};

export function diseaseIcon(slug: string, category?: string): string {
  if (ICONS[slug]) return ICONS[slug];
  if (category === "imaging") return "🔬";
  if (category === "clinical") return "💉";
  return "📈";
}
