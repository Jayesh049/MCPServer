import { useState, useEffect, useRef } from "react";

// ── DATA ──────────────────────────────────────────────────────────────────────
const DISEASES = [
  {
    id: "liver",
    name: "Liver Disease (Clinical)",
    pct: 100,
    keywords: ["alt", "ast", "bilirubin", "cirrhosis"],
    color: "#f97316",
    markers: [
      { name: "ALT (Alanine Aminotransferase)", value: "High", status: "bad", note: "Elevated → liver cell damage. Normal: 7–56 U/L" },
      { name: "AST (Aspartate Aminotransferase)", value: "High", status: "bad", note: "Elevated → liver/muscle injury. Normal: 10–40 U/L" },
      { name: "Bilirubin", value: "High", status: "bad", note: "High → bile buildup, jaundice risk. Normal: 0.1–1.2 mg/dL" },
      { name: "Cirrhosis Indicators", value: "Present", status: "bad", note: "Scarring of liver tissue — requires monitoring" },
    ],
    workOn: ["Reduce alcohol intake completely", "Low-fat, high-fiber diet", "Avoid hepatotoxic medications", "Regular ultrasound + LFT tests every 3 months"],
    affirmation: "My liver is healing one healthy choice at a time.",
  },
  {
    id: "diabetes",
    name: "Diabetes Risk (Clinical)",
    pct: 80,
    keywords: ["diabetes", "hba1c", "a1c"],
    color: "#eab308",
    markers: [
      { name: "HbA1c", value: "Borderline High", status: "warn", note: "5.7–6.4% = Pre-diabetes. ≥6.5% = Diabetes" },
      { name: "Fasting Glucose", value: "Elevated", status: "warn", note: "100–125 mg/dL = Pre-diabetic range" },
      { name: "Insulin Sensitivity", value: "Reduced", status: "bad", note: "Cells responding poorly to insulin" },
    ],
    workOn: ["Cut refined sugar & white carbs", "Walk 30 min after meals", "Monitor fasting glucose weekly", "Target HbA1c < 5.7%"],
    affirmation: "I am choosing foods that fuel and protect me.",
  },
  {
    id: "tb",
    name: "Tuberculosis (Chest X-ray)",
    pct: 65,
    keywords: ["tuberculosis", "tb"],
    color: "#06b6d4",
    markers: [
      { name: "Chest X-ray Opacity", value: "Detected", status: "bad", note: "Shadows in lung fields — TB pattern" },
      { name: "TB Keywords in Report", value: "Present", status: "warn", note: "Clinical mention in diagnostic text" },
    ],
    workOn: ["Consult pulmonologist immediately", "Complete full DOTS therapy if confirmed", "Improve ventilation at home", "Avoid crowded spaces until cleared"],
    affirmation: "I face this challenge with courage and commitment.",
  },
  {
    id: "heart",
    name: "Heart Disease Risk",
    pct: 65,
    keywords: ["cad", "ascvd"],
    color: "#ec4899",
    markers: [
      { name: "CAD (Coronary Artery Disease)", value: "Risk Detected", status: "warn", note: "Plaque buildup in coronary arteries → reduced blood flow" },
      { name: "ASCVD Score", value: "Intermediate", status: "warn", note: "10-year cardiovascular event risk elevated" },
      { name: "LDL Cholesterol", value: "Elevated", status: "bad", note: "High LDL accelerates artery blockage. Target < 100 mg/dL" },
      { name: "Blood Pressure", value: "High-Normal", status: "warn", note: "130–139/80–89 mmHg = Stage 1 hypertension" },
    ],
    workOn: ["DASH diet — reduce sodium, increase potassium", "Cardio exercise 150 min/week", "Statin therapy (consult cardiologist)", "Quit smoking if applicable"],
    affirmation: "My heart grows stronger with every step I take.",
  },
  {
    id: "kidney",
    name: "Chronic Kidney Disease",
    pct: 65,
    keywords: ["creatinine", "proteinuria"],
    color: "#8b5cf6",
    markers: [
      { name: "Creatinine", value: "Elevated", status: "bad", note: "High → kidneys not filtering waste. Normal: 0.7–1.2 mg/dL" },
      { name: "Proteinuria", value: "Present", status: "bad", note: "Protein leaking into urine → kidney damage signal" },
      { name: "eGFR", value: "Reduced", status: "warn", note: "Estimated glomerular filtration rate < 60 = CKD stage 3" },
    ],
    workOn: ["Low-protein, low-sodium diet", "Control blood sugar & BP tightly", "Avoid NSAIDs (ibuprofen, naproxen)", "Nephrology follow-up every 6 months"],
    affirmation: "I nourish my kidneys with every mindful choice.",
  },
];

const EXERCISES = [
  { id: 1, icon: "🚶", name: "Walking Program", desc: "Low-impact aerobic walks at a conversational pace.", freq: "20–30 min, 5×/week", intensity: "MODERATE", intensityColor: "#eab308", doctor: "Dr. Priya Iyer", tip: "Walk after meals — reduces post-meal glucose spikes by up to 22%." },
  { id: 2, icon: "💪", name: "Strength Basics", desc: "Sit-to-stands, wall push-ups, banded rows.", freq: "2–3 sets × 10, 2–3×/week", intensity: "LOW", intensityColor: "#22c55e", doctor: "Dr. Idris Ahmed", tip: "Muscle mass protects metabolic health. Start with chair-assisted movements." },
  { id: 3, icon: "🧘", name: "Mobility & Stretching", desc: "Full-body stretches focused on hips, shoulders, neck.", freq: "10 min daily", intensity: "LOW", intensityColor: "#22c55e", doctor: "Dr. Yuki Tanaka", tip: "Morning stretches reduce cortisol by 15% — setting a calm tone for the day." },
  { id: 4, icon: "🌬️", name: "Mindful Breathing", desc: "Box breathing 4-4-4-4 for stress regulation.", freq: "10 min, 2×/day", intensity: "LOW", intensityColor: "#22c55e", doctor: "Dr. Samir Choudhury", tip: "4 counts in → 4 hold → 4 out → 4 hold. Activates the parasympathetic system." },
];

const DOCTORS = [
  { id: 1, name: "Dr. Idris Ahmed", spec: "Neuro-oncology", hospital: "Greenfield Research Hospital · Berlin", yrs: 13, exercises: ["Strength Basics"], bio: "Dr. Ahmed specializes in brain and spinal cord tumors. He advocates resistance training to combat treatment-related fatigue and preserve muscle mass during chemotherapy.", approach: "Evidence-based functional training protocols tailored for oncology patients." },
  { id: 2, name: "Dr. Hannah Becker", spec: "Neurology", hospital: "Lighthouse University Hospital · London", yrs: 17, exercises: [], bio: "Expert in neurological conditions including epilepsy and MS. She focuses on neuroprotective lifestyle interventions.", approach: "Holistic brain health: sleep hygiene, omega-3 nutrition, cognitive exercises." },
  { id: 3, name: "Dr. Yuki Tanaka", spec: "Radiation Oncology", hospital: "Sapphire Coast Medical College · Mumbai", yrs: 14, exercises: ["Mobility & Stretching"], bio: "Pioneering radiation therapist who emphasizes mobility work to counter radiation-induced stiffness and lymphedema.", approach: "Gentle movement post-radiation to restore range of motion and reduce inflammation." },
  { id: 4, name: "Dr. Priya Iyer", spec: "Surgical Oncology", hospital: "Mountain View Memorial Hospital · Denver", yrs: 20, exercises: ["Walking Program"], bio: "Senior surgical oncologist with 20 years specializing in complex tumor resections. Prescribes walking programs to accelerate post-surgical recovery.", approach: "Early mobilization post-surgery: even 5 min walks reduce DVT risk by 40%." },
  { id: 5, name: "Dr. Samir Choudhury", spec: "Psychiatry", hospital: "Sapphire Coast Medical College · Mumbai", yrs: 12, exercises: ["Mindful Breathing"], bio: "Oncopsychiatrist helping cancer patients manage anxiety, depression, and trauma. He designed the box breathing protocol in this care plan.", approach: "Mind-body integration: breath, journaling, and CBT for treatment resilience." },
];

const AFFIRMATIONS = [
  { icon: "✦", label: "PRESENCE", text: "I take this one breath, one moment at a time." },
  { icon: "◆", label: "AGENCY", text: "I am an active participant in my own care, not a passive observer." },
  { icon: "○", label: "SUPPORT", text: "I let trusted people walk beside me on this path." },
  { icon: "♡", label: "COMPASSION", text: "I extend the same kindness to myself that I would to a dear friend." },
  { icon: "⊕", label: "HOPE", text: "Healing is not linear; small steps still count." },
  { icon: "◇", label: "RESILIENCE", text: "I have faced hard days before and found my way through." },
  { icon: "∞", label: "RENEWAL", text: "Each morning I begin again with intention." },
  { icon: "★", label: "STRENGTH", text: "My body is doing its best every single day." },
];

// ── FLASHCARD POPUP ───────────────────────────────────────────────────────────
function FlashcardPopup({ cards, startIndex = 0, onClose, renderCard }) {
  const [idx, setIdx] = useState(startIndex);
  const [dir, setDir] = useState(null);
  const [animating, setAnimating] = useState(false);
  const touchStart = useRef(null);

  const go = (direction) => {
    if (animating) return;
    const next = direction === "next" ? idx + 1 : idx - 1;
    if (next < 0 || next >= cards.length) return;
    setDir(direction);
    setAnimating(true);
    setTimeout(() => { setIdx(next); setDir(null); setAnimating(false); }, 320);
  };

  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) go(diff > 0 ? "next" : "prev");
    touchStart.current = null;
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === "ArrowRight") go("next"); if (e.key === "ArrowLeft") go("prev"); if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, animating]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ position: "relative", width: "min(92vw, 560px)", maxHeight: "90vh" }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: -44, right: 0, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>×</button>

        {/* Counter */}
        <div style={{ textAlign: "center", marginBottom: 16, color: "rgba(255,255,255,0.5)", fontSize: 12, letterSpacing: 3 }}>
          {idx + 1} / {cards.length}
        </div>

        {/* Card */}
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          style={{ transform: animating ? `translateX(${dir === "next" ? "-60px" : "60px"}) scale(0.95)` : "translateX(0) scale(1)", opacity: animating ? 0 : 1, transition: "all 0.32s cubic-bezier(.4,0,.2,1)" }}>
          {renderCard(cards[idx], idx)}
        </div>

        {/* Dots + Arrows */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
          <button onClick={() => go("prev")} disabled={idx === 0} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: idx === 0 ? "rgba(255,255,255,0.2)" : "#fff", borderRadius: 8, padding: "6px 14px", cursor: idx === 0 ? "default" : "pointer", fontSize: 16 }}>←</button>
          <div style={{ display: "flex", gap: 6 }}>
            {cards.map((_, i) => <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 24 : 8, height: 8, borderRadius: 4, background: i === idx ? "#22d3ee" : "rgba(255,255,255,0.2)", cursor: "pointer", transition: "all 0.2s" }} />)}
          </div>
          <button onClick={() => go("next")} disabled={idx === cards.length - 1} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", color: idx === cards.length - 1 ? "rgba(255,255,255,0.2)" : "#fff", borderRadius: 8, padding: "6px 14px", cursor: idx === cards.length - 1 ? "default" : "pointer", fontSize: 16 }}>→</button>
        </div>
        <div style={{ textAlign: "center", marginTop: 8, color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Swipe or use arrow keys to navigate</div>
      </div>
    </div>
  );
}

// ── DISEASE CARD RENDERER ─────────────────────────────────────────────────────
function DiseaseFlashCard(disease) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderRadius: 20, border: `1.5px solid ${disease.color}40`, padding: "28px 28px 24px", maxHeight: "70vh", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ background: `${disease.color}20`, border: `1px solid ${disease.color}60`, borderRadius: 12, padding: "8px 14px", color: disease.color, fontWeight: 700, fontSize: 13 }}>{disease.pct}% MATCH</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "Georgia, serif" }}>{disease.name}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{disease.keywords.join(" · ")}</div>
        </div>
      </div>

      {/* Markers */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>📊 BIOMARKERS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {disease.markers.map((m, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px", borderLeft: `3px solid ${m.status === "bad" ? "#ef4444" : m.status === "warn" ? "#eab308" : "#22c55e"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                <span style={{ color: m.status === "bad" ? "#ef4444" : m.status === "warn" ? "#eab308" : "#22c55e", fontSize: 12, fontWeight: 700 }}>{m.value}</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 4 }}>{m.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Work On */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>🎯 WHAT TO WORK ON</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {disease.workOn.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: disease.color, fontSize: 14, marginTop: 1 }}>→</span>
              <span style={{ color: "#cbd5e1", fontSize: 13 }}>{w}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Affirmation */}
      <div style={{ background: `${disease.color}12`, border: `1px solid ${disease.color}30`, borderRadius: 12, padding: "12px 16px", fontStyle: "italic", color: disease.color, fontSize: 13, textAlign: "center" }}>
        "{disease.affirmation}"
      </div>
    </div>
  );
}

// ── EXERCISE CARD RENDERER ────────────────────────────────────────────────────
function ExerciseFlashCard(ex) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0d1f1a 0%, #1a2e28 100%)", borderRadius: 20, border: "1.5px solid rgba(34,197,94,0.3)", padding: "28px" }}>
      <div style={{ fontSize: 48, marginBottom: 12, textAlign: "center" }}>{ex.icon}</div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 22, fontFamily: "Georgia, serif" }}>{ex.name}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6 }}>{ex.desc}</div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "6px 12px", color: "#22c55e", fontSize: 12 }}>⏱ {ex.freq}</div>
        <div style={{ background: `${ex.intensityColor}18`, border: `1px solid ${ex.intensityColor}40`, borderRadius: 8, padding: "6px 12px", color: ex.intensityColor, fontSize: 12, fontWeight: 700 }}>{ex.intensity}</div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", borderLeft: "3px solid #22d3ee", marginBottom: 16 }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>💡 DOCTOR'S TIP</div>
        <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>{ex.tip}</div>
      </div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" }}>Prescribed by: <span style={{ color: "#22d3ee" }}>{ex.doctor}</span></div>
    </div>
  );
}

// ── DOCTOR CARD RENDERER ──────────────────────────────────────────────────────
function DoctorFlashCard(doc) {
  return (
    <div style={{ background: "linear-gradient(135deg, #1a0f2e 0%, #2d1b4e 100%)", borderRadius: 20, border: "1.5px solid rgba(139,92,246,0.3)", padding: "28px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>🧑‍⚕️</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "Georgia, serif" }}>{doc.name}</div>
          <div style={{ color: "#a855f7", fontSize: 13, marginTop: 3 }}>{doc.spec}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{doc.hospital}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <div style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, padding: "5px 12px", color: "#a855f7", fontSize: 12 }}>⭐ {doc.yrs} yrs experience</div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>👤 ABOUT</div>
        <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6 }}>{doc.bio}</div>
      </div>
      <div style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>🎯 APPROACH</div>
        <div style={{ color: "#22d3ee", fontSize: 13, lineHeight: 1.6, fontStyle: "italic" }}>{doc.approach}</div>
      </div>
      {doc.exercises.length > 0 && (
        <div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>💪 PRESCRIBED EXERCISES</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {doc.exercises.map((e, i) => <div key={i} style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "4px 10px", color: "#22c55e", fontSize: 12 }}>{e}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AFFIRMATION CARD RENDERER ─────────────────────────────────────────────────
function AffirmationFlashCard(aff) {
  return (
    <div style={{ background: "linear-gradient(135deg, #1e1a0f 0%, #2d2818 100%)", borderRadius: 20, border: "1.5px solid rgba(251,191,36,0.3)", padding: "48px 32px", textAlign: "center", minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 16, color: "#fbbf24" }}>{aff.icon}</div>
      <div style={{ color: "rgba(251,191,36,0.6)", fontSize: 11, letterSpacing: 4, marginBottom: 20 }}>{aff.label}</div>
      <div style={{ color: "#fff", fontSize: 22, fontFamily: "Georgia, serif", lineHeight: 1.5, fontStyle: "italic" }}>"{aff.text}"</div>
    </div>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────────────────────
function SectionHeader({ num, title, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div style={{ width: 32, height: 2, background: "#22d3ee" }} />
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 3 }}>{num} · {title}</span>
      {badge && <div style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)", borderRadius: 20, padding: "3px 12px", color: "#22d3ee", fontSize: 11, letterSpacing: 1 }}>{badge}</div>}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [popup, setPopup] = useState(null); // { type, cards, startIndex, renderCard }
  const [tab, setTab] = useState("diseases");

  const openDiseases = (idx = 0) => setPopup({ cards: DISEASES, startIndex: idx, renderCard: DiseaseFlashCard });
  const openExercises = (idx = 0) => setPopup({ cards: EXERCISES, startIndex: idx, renderCard: ExerciseFlashCard });
  const openDoctors = (idx = 0) => setPopup({ cards: DOCTORS, startIndex: idx, renderCard: DoctorFlashCard });
  const openAffirmations = (idx = 0) => setPopup({ cards: AFFIRMATIONS, startIndex: idx, renderCard: AffirmationFlashCard });

  const S = { // styles shorthand
    card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px", cursor: "pointer", transition: "all 0.2s" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#070d1a", color: "#fff", fontFamily: "'Segoe UI', sans-serif", padding: "32px 20px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{ background: "linear-gradient(135deg, #22d3ee, #6366f1)", borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>REPORT ANALYZER</div>
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "3px 12px", color: "#ef4444", fontSize: 11 }}>Synthetic · No PHI</div>
        </div>
        <h1 style={{ fontSize: "clamp(24px,5vw,36px)", fontFamily: "Georgia, serif", fontWeight: 700, marginBottom: 4 }}>Health Intelligence Dashboard</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Click any card to open interactive flashcards · Swipe or use arrow keys to navigate</p>
      </div>

      {/* Overview Stats */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 24px", marginBottom: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 16 }}>
        <div onClick={() => openDiseases()} style={{ cursor: "pointer" }}>
          <div style={{ color: "#22d3ee", fontSize: 32, fontWeight: 700 }}>5</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Detected Diseases</div>
        </div>
        <div onClick={() => openExercises()} style={{ cursor: "pointer" }}>
          <div style={{ color: "#22c55e", fontSize: 32, fontWeight: 700 }}>4</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Exercises</div>
        </div>
        <div onClick={() => openDoctors()} style={{ cursor: "pointer" }}>
          <div style={{ color: "#a855f7", fontSize: 32, fontWeight: 700 }}>5</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Specialists</div>
        </div>
        <div onClick={() => openAffirmations()} style={{ cursor: "pointer" }}>
          <div style={{ color: "#fbbf24", fontSize: 32, fontWeight: 700 }}>8</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Affirmations</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ color: "#22d3ee", fontSize: 20 }}>↻</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Daily Refresh</div>
        </div>
      </div>

      {/* ── SECTION 01: Diseases ── */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader num="01" title="DETECTED DISEASES" badge="KEYWORD MATCH" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DISEASES.map((d, i) => (
            <div key={d.id} onClick={() => openDiseases(i)}
              style={{ ...S.card, display: "flex", alignItems: "center", gap: 16 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = `${d.color}50`; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
              {/* Bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                  <span style={{ color: d.color, fontWeight: 700, fontSize: 15, flexShrink: 0, marginLeft: 8 }}>{d.pct}%</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.pct}%`, background: d.color, borderRadius: 3, transition: "width 1s ease" }} />
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 5 }}>{d.keywords.join(" · ")}</div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 18, flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center" }}>↑ Click any disease to see biomarkers, what's high/low, and what to work on</div>
      </div>

      {/* ── SECTION 02: Exercises ── */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader num="02" title="EXERCISES" badge="SYNTHETIC CARE PLAN · DAILY REFRESH" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
          {EXERCISES.map((ex, i) => (
            <div key={ex.id} onClick={() => openExercises(i)}
              style={{ ...S.card, textAlign: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.08)"; e.currentTarget.style.borderColor = "rgba(34,197,94,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{ex.icon}</div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ex.name}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 10 }}>{ex.desc}</div>
              <div style={{ background: `${ex.intensityColor}18`, border: `1px solid ${ex.intensityColor}40`, borderRadius: 6, padding: "3px 8px", display: "inline-block", color: ex.intensityColor, fontSize: 11, fontWeight: 700 }}>{ex.intensity}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 03: Doctors ── */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader num="03" title="TOP SPECIALISTS" badge="FICTIONAL · DATE-SEEDED" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
          {DOCTORS.map((doc, i) => (
            <div key={doc.id} onClick={() => openDoctors(i)}
              style={{ ...S.card }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 10 }}>🧑‍⚕️</div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{doc.name}</div>
              <div style={{ color: "#a855f7", fontSize: 11, marginBottom: 4 }}>{doc.spec}</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 8 }}>{doc.hospital}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#fbbf24", fontSize: 12 }}>⭐</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{doc.yrs} yrs</span>
              </div>
              {doc.exercises.length > 0 && <div style={{ marginTop: 8, background: "rgba(34,197,94,0.1)", borderRadius: 6, padding: "3px 8px", color: "#22c55e", fontSize: 10 }}>💪 Exercises prescribed</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 04: Affirmations ── */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader num="04" title="POSITIVE MANIFESTATIONS" badge="MINDFULNESS · CARE PLAN" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
          {AFFIRMATIONS.map((a, i) => (
            <div key={i} onClick={() => openAffirmations(i)}
              style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-start" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(251,191,36,0.07)"; e.currentTarget.style.borderColor = "rgba(251,191,36,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
              <span style={{ color: "#fbbf24", fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
              <div>
                <div style={{ color: "rgba(251,191,36,0.6)", fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>{a.label}</div>
                <div style={{ color: "#e2e8f0", fontSize: 12, lineHeight: 1.5, fontStyle: "italic" }}>{a.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 18px", color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 1.8 }}>
        — All doctors, hospitals, and patient details shown are SYNTHETIC and fictional.<br />
        — Medication names are real but doses/regimens are illustrative only and NOT a clinical recommendation.<br />
        — Always consult a qualified clinician before starting, stopping, or changing any treatment.
      </div>

      {/* FLASHCARD POPUP */}
      {popup && (
        <FlashcardPopup
          cards={popup.cards}
          startIndex={popup.startIndex}
          renderCard={popup.renderCard}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
