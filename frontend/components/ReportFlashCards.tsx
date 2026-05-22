/**
 * ReportFlashCards.tsx
 *
 * Drop-in replacement for the care-plan rendering section of the Report Analyzer page.
 *
 * USAGE  (in your existing report page, replace the care-plan JSX block with):
 *   import { ReportFlashCards } from "./ReportFlashCards";
 *   <ReportFlashCards carePlan={analysis.carePlan} />
 *
 * WHAT IT RENDERS:
 *   1. Personal Health Summary  → 1 flashcard (swipeable)
 *   2. Exercises                → 1 flashcard per exercise, carousel
 *   3. Doctors                  → shows 3 cards; click → DoctorDetailModal
 *   4. Yoga / Affirmations      → 1 flashcard per affirmation, carousel
 *
 * DATA FRESHNESS:
 *   • Care-plan data is re-fetched from the API on mount if older than 3 days.
 *   • localStorage key: `careplan_cache_<slug>` stores { data, fetchedAt }.
 *   • Set NEXT_PUBLIC_API_URL (or VITE_API_URL) to your backend base URL.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types (mirrors src/care/types.ts — no direct import needed on frontend)
// ---------------------------------------------------------------------------
export type Medication = {
  name: string;
  dose: string;
  schedule: string;
  rationale: string;
  cautions: string[];
};

export type Hospital = { name: string; city: string; country: string };

export type Doctor = {
  name: string;
  specialty: string;
  yearsOfExperience: number;
  hospital: Hospital;
  bio: string;
  medications: Medication[];
};

export type Exercise = {
  name: string;
  description: string;
  frequency: string;
  intensity: "low" | "moderate" | "high";
  cautions: string[];
};

export type Affirmation = { theme: string; statement: string };

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

// ---------------------------------------------------------------------------
// Cache helpers (3-day freshness)
// ---------------------------------------------------------------------------
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function getCached(slug: string): CarePlan | null {
  try {
    const raw = localStorage.getItem(`careplan_cache_${slug}`);
    if (!raw) return null;
    const { data, fetchedAt } = JSON.parse(raw) as { data: CarePlan; fetchedAt: number };
    if (Date.now() - fetchedAt > THREE_DAYS_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(slug: string, data: CarePlan) {
  try {
    localStorage.setItem(`careplan_cache_${slug}`, JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {}
}

async function fetchCarePlan(slug: string): Promise<CarePlan | null> {
  try {
    const res = await fetch(`/api/diseases/${encodeURIComponent(slug)}/care-plan`);
    if (!res.ok) return null;
    const json = (await res.json()) as CarePlan;
    return json?.diseaseSlug ? json : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Intensity badge
// ---------------------------------------------------------------------------
function IntensityBadge({ level }: { level: "low" | "moderate" | "high" }) {
  const map = {
    low: { bg: "rgba(16,185,129,0.18)", color: "#6ee7b7", label: "Low" },
    moderate: { bg: "rgba(245,158,11,0.18)", color: "#fcd34d", label: "Moderate" },
    high: { bg: "rgba(239,68,68,0.18)", color: "#fca5a5", label: "High" },
  };
  const s = map[level];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.color}33`,
        borderRadius: 6,
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Base Flashcard shell
// ---------------------------------------------------------------------------
function FlashCard({
  children,
  accent = "#6366f1",
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(17,17,34,0.72)",
        border: `1px solid ${accent}44`,
        borderRadius: 16,
        padding: "20px 22px",
        backdropFilter: "blur(12px)",
        boxShadow: `0 0 32px ${accent}18`,
        minHeight: 140,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "transform 0.18s, box-shadow 0.18s",
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 40px ${accent}30`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 32px ${accent}18`;
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal scroll carousel
// ---------------------------------------------------------------------------
function Carousel({ children, gap = 16 }: { children: React.ReactNode; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [check]);

  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  const btnStyle = (visible: boolean): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(99,102,241,0.22)",
    border: "1px solid rgba(99,102,241,0.45)",
    color: "#a5b4fc",
    borderRadius: 10,
    width: 34,
    height: 34,
    cursor: visible ? "pointer" : "default",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s",
    zIndex: 2,
  });

  return (
    <div style={{ position: "relative" }}>
      <button style={{ ...btnStyle(canLeft), left: -18 }} onClick={() => scroll(-1)}>‹</button>
      <div
        ref={ref}
        style={{
          display: "flex",
          gap,
          overflowX: "auto",
          scrollbarWidth: "none",
          paddingBottom: 4,
        }}
        onLoad={check}
      >
        {children}
      </div>
      <button style={{ ...btnStyle(canRight), right: -18 }} onClick={() => scroll(1)}>›</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            background: "rgba(99,102,241,0.2)",
            border: "1px solid rgba(99,102,241,0.5)",
            color: "#a5b4fc",
            borderRadius: 8,
            padding: "2px 9px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {num}
        </span>
        <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>{title}</span>
      </div>
      {sub && <p style={{ color: "#64748b", fontSize: 12, marginTop: 4, marginLeft: 2 }}>{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Personal Health Summary card
// ---------------------------------------------------------------------------
function HealthSummaryCard({ plan }: { plan: CarePlan }) {
  return (
    <FlashCard accent="#6366f1" style={{ maxWidth: 480 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>🩺</span>
        <div>
          <div style={{ color: "#c7d2fe", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Personal Health Summary
          </div>
          <div style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 700, marginTop: 2 }}>
            {plan.diseaseName}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 3 }}>Exercises</div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>{plan.exercises.length}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 3 }}>Specialists</div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>{plan.topDoctors.length}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 3 }}>Affirmations</div>
          <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 15 }}>{plan.affirmations.length}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 3 }}>Plan type</div>
          <div style={{ color: "#6ee7b7", fontWeight: 600, fontSize: 12 }}>Synthetic ✓</div>
        </div>
      </div>
      <div style={{ color: "#475569", fontSize: 11, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8, marginTop: 4 }}>
        Generated {new Date(plan.generatedAt).toLocaleDateString()} · Education only
      </div>
    </FlashCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Exercise flashcards
// ---------------------------------------------------------------------------
function ExerciseCard({ ex }: { ex: Exercise }) {
  const accent = ex.intensity === "high" ? "#ef4444" : ex.intensity === "moderate" ? "#f59e0b" : "#10b981";
  return (
    <FlashCard accent={accent} style={{ minWidth: 240, maxWidth: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14, lineHeight: 1.3, maxWidth: "70%" }}>
          {ex.name}
        </span>
        <IntensityBadge level={ex.intensity} />
      </div>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{ex.description}</p>
      <div style={{ color: "#64748b", fontSize: 12 }}>⏱ {ex.frequency}</div>
      {ex.cautions.length > 0 && (
        <div style={{ color: "#fbbf24", fontSize: 11, background: "rgba(251,191,36,0.07)", borderRadius: 6, padding: "4px 8px" }}>
          ⚠ {ex.cautions[0]}
        </div>
      )}
    </FlashCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Doctor cards (show 3) + Detail Modal
// ---------------------------------------------------------------------------
function DoctorCard({ doc, onClick }: { doc: Doctor; onClick: () => void }) {
  return (
    <FlashCard
      accent="#0ea5e9"
      style={{ minWidth: 220, maxWidth: 235, cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          👨‍⚕️
        </div>
        <div>
          <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 13 }}>{doc.name}</div>
          <div style={{ color: "#7dd3fc", fontSize: 11 }}>{doc.specialty}</div>
        </div>
      </div>
      <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.4 }}>{doc.bio}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#64748b", fontSize: 11 }}>
          {doc.hospital.name} · {doc.hospital.city}
        </span>
        <span
          style={{
            color: "#7dd3fc",
            fontSize: 11,
            background: "rgba(14,165,233,0.12)",
            borderRadius: 6,
            padding: "2px 8px",
          }}
        >
          {doc.yearsOfExperience} yrs
        </span>
      </div>
      <button
        onClick={onClick}
        style={{
          background: "rgba(14,165,233,0.15)",
          border: "1px solid rgba(14,165,233,0.4)",
          color: "#7dd3fc",
          borderRadius: 8,
          padding: "6px 0",
          fontSize: 12,
          cursor: "pointer",
          width: "100%",
          fontWeight: 600,
          letterSpacing: "0.04em",
          marginTop: 4,
        }}
      >
        View full profile →
      </button>
    </FlashCard>
  );
}

function DoctorDetailModal({ doc, onClose }: { doc: Doctor; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0f0f1f",
          border: "1px solid rgba(14,165,233,0.3)",
          borderRadius: 20,
          padding: "28px 30px",
          maxWidth: 600,
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              👨‍⚕️
            </div>
            <div>
              <h2 style={{ color: "#f1f5f9", margin: 0, fontSize: 20, fontWeight: 700 }}>{doc.name}</h2>
              <div style={{ color: "#7dd3fc", fontSize: 13, marginTop: 2 }}>{doc.specialty}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {doc.hospital.name} · {doc.hospital.city}, {doc.hospital.country}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 22, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {[
            { label: "Experience", value: `${doc.yearsOfExperience} yrs` },
            { label: "Specialty", value: doc.specialty },
            { label: "Location", value: `${doc.hospital.city}, ${doc.hospital.country}` },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div style={{ color: "#64748b", fontSize: 11, marginBottom: 3 }}>{s.label}</div>
              <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Bio */}
        <div
          style={{
            background: "rgba(14,165,233,0.07)",
            border: "1px solid rgba(14,165,233,0.2)",
            borderRadius: 10,
            padding: "12px 16px",
            color: "#94a3b8",
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          {doc.bio}
        </div>

        {/* Medications table */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              color: "#c7d2fe",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Suggested Medications (illustrative only)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {doc.medications.map((med, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr 1fr",
                  gap: 10,
                  alignItems: "start",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  borderLeft: "2px solid rgba(99,102,241,0.4)",
                }}
              >
                <span style={{ color: "#64748b", fontSize: 11, paddingTop: 1 }}>#{i + 1}</span>
                <div>
                  <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13 }}>{med.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>{med.dose} · {med.schedule}</div>
                  {med.cautions.length > 0 && (
                    <div style={{ color: "#fbbf24", fontSize: 11, marginTop: 2 }}>
                      ⚠ {med.cautions.join(", ")}
                    </div>
                  )}
                </div>
                <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>{med.rationale}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div
          style={{
            color: "#475569",
            fontSize: 11,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 12,
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          ⚠ All doctor, hospital, and medication details are SYNTHETIC and fictional.
          Medication doses/regimens are illustrative only. Always consult a qualified clinician.
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Affirmation / Yoga flashcards
// ---------------------------------------------------------------------------
const AFFIRMATION_ICONS: Record<string, string> = {
  presence: "🧘",
  agency: "💪",
  support: "🤝",
  compassion: "💙",
  hope: "🌱",
  rest: "😌",
  trust: "🌟",
  celebration: "🎉",
};

function AffirmationCard({ aff }: { aff: Affirmation }) {
  const icon = AFFIRMATION_ICONS[aff.theme.toLowerCase()] ?? "✨";
  return (
    <FlashCard accent="#8b5cf6" style={{ minWidth: 220, maxWidth: 240 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span
          style={{
            color: "#c4b5fd",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {aff.theme}
        </span>
      </div>
      <p
        style={{
          color: "#e2e8f0",
          fontSize: 14,
          fontStyle: "italic",
          margin: 0,
          lineHeight: 1.6,
          borderLeft: "2px solid rgba(139,92,246,0.5)",
          paddingLeft: 10,
        }}
      >
        "{aff.statement}"
      </p>
    </FlashCard>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ReportFlashCards({
  carePlan: initialPlan,
  diseaseSlug,
}: {
  carePlan: CarePlan | null;
  /** When carePlan is null, fetch by slug (secondary diseases). */
  diseaseSlug?: string;
}) {
  const [plan, setPlan] = useState<CarePlan | null>(initialPlan);
  const [selectedDoc, setSelectedDoc] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(false);

  // Refresh if stale (older than 3 days) or load by slug
  useEffect(() => {
    const slug = initialPlan?.diseaseSlug ?? diseaseSlug;
    if (!slug) return;

    const cached = getCached(slug);
    if (cached) {
      setPlan(cached);
      return;
    }

    if (initialPlan && initialPlan.diseaseSlug === slug) {
      setPlan(initialPlan);
    }

    setLoading(true);
    fetchCarePlan(slug).then((fresh) => {
      if (fresh) {
        setCache(slug, fresh);
        setPlan(fresh);
      } else if (initialPlan?.diseaseSlug === slug) {
        setPlan(initialPlan);
      }
      setLoading(false);
    });
  }, [initialPlan, diseaseSlug]);

  if (!plan) return null;

  const displayDoctors = plan.topDoctors.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {loading && (
        <div style={{ color: "#64748b", fontSize: 12, textAlign: "right" }}>
          ↻ Refreshing care plan data…
        </div>
      )}

      {/* ── 1. Personal Health ── */}
      <section>
        <SectionHeader num="01" title="Personal Health Overview" />
        <HealthSummaryCard plan={plan} />
      </section>

      {/* ── 2. Exercises ── */}
      <section>
        <SectionHeader
          num="02"
          title="Exercises for the Healing Phase"
          sub={`${plan.exercises.length} exercises · scroll to see all`}
        />
        <Carousel>
          {plan.exercises.map((ex, i) => (
            <ExerciseCard key={i} ex={ex} />
          ))}
        </Carousel>
      </section>

      {/* ── 3. Doctors (3 visible, click for detail) ── */}
      <section>
        <SectionHeader
          num="03"
          title="Top Specialists"
          sub="Showing 3 of 5 · click any card to see full profile & medications"
        />
        <Carousel>
          {displayDoctors.map((doc, i) => (
            <DoctorCard key={i} doc={doc} onClick={() => setSelectedDoc(doc)} />
          ))}
        </Carousel>
      </section>

      {/* ── 4. Affirmations / Yoga ── */}
      <section>
        <SectionHeader
          num="04"
          title="Positive Manifestations"
          sub="Mindfulness affirmations for the healing phase"
        />
        <Carousel>
          {plan.affirmations.map((aff, i) => (
            <AffirmationCard key={i} aff={aff} />
          ))}
        </Carousel>
      </section>

      {/* Disclaimers */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "12px 16px",
        }}
      >
        {plan.disclaimers.map((d, i) => (
          <p key={i} style={{ color: "#475569", fontSize: 11, margin: "2px 0", lineHeight: 1.5 }}>
            — {d}
          </p>
        ))}
      </div>

      {/* Doctor detail modal */}
      {selectedDoc && (
        <DoctorDetailModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
}
