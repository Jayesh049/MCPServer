"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CarePlan, DiseaseHit } from "../lib/types";
import {
  mapAffirmations,
  mapDiseaseHits,
  mapDoctors,
  mapExercises,
  type AffirmationFlashView,
  type DiseaseFlashView,
  type DoctorFlashView,
  type ExerciseFlashView
} from "../lib/health-flashcard-mappers";

function FlashcardPopup<T>({
  cards,
  startIndex = 0,
  onClose,
  renderCard
}: {
  cards: T[];
  startIndex?: number;
  onClose: () => void;
  renderCard: (item: T) => ReactNode;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const [animating, setAnimating] = useState(false);
  const touchStart = useRef<number | null>(null);

  const go = useCallback(
    (direction: "next" | "prev") => {
      if (animating) return;
      const next = direction === "next" ? idx + 1 : idx - 1;
      if (next < 0 || next >= cards.length) return;
      setDir(direction);
      setAnimating(true);
      window.setTimeout(() => {
        setIdx(next);
        setDir(null);
        setAnimating(false);
      }, 320);
    },
    [animating, idx, cards.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go("next");
      if (e.key === "ArrowLeft") go("prev");
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, onClose]);

  const animClass = animating ? (dir === "next" ? "anim-next" : "anim-prev") : "";

  return (
    <div
      className="hfc-popup-overlay"
      role="dialog"
      aria-modal
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="hfc-popup-inner">
        <button type="button" className="hfc-popup-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="hfc-popup-counter">
          {idx + 1} / {cards.length}
        </div>
        <div
          className={`hfc-popup-card ${animClass}`}
          onTouchStart={(e) => {
            touchStart.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStart.current === null) return;
            const diff = touchStart.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) go(diff > 0 ? "next" : "prev");
            touchStart.current = null;
          }}
        >
          {renderCard(cards[idx])}
        </div>
        <div className="hfc-popup-nav">
          <button type="button" onClick={() => go("prev")} disabled={idx === 0}>
            ←
          </button>
          <div className="hfc-dots">
            {cards.map((_, i) => (
              <div
                key={i}
                className={`hfc-dot${i === idx ? " on" : ""}`}
                onClick={() => setIdx(i)}
                role="presentation"
              />
            ))}
          </div>
          <button type="button" onClick={() => go("next")} disabled={idx === cards.length - 1}>
            →
          </button>
        </div>
        <div className="hfc-popup-foot">Swipe or use arrow keys to navigate</div>
      </div>
    </div>
  );
}

function DiseaseFlashCard({ d }: { d: DiseaseFlashView }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: 20,
        border: `1.5px solid ${d.color}40`,
        padding: "28px 28px 24px",
        maxHeight: "70vh",
        overflowY: "auto"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div
          style={{
            background: `${d.color}20`,
            border: `1px solid ${d.color}60`,
            borderRadius: 12,
            padding: "8px 14px",
            color: d.color,
            fontWeight: 700,
            fontSize: 13
          }}
        >
          {d.pct}% MATCH
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "var(--font-display), serif" }}>
            {d.name}
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{d.keywords.join(" · ")}</div>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
          📊 BIOMARKERS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {d.markers.map((m, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                padding: "10px 14px",
                borderLeft: `3px solid ${m.status === "bad" ? "#ef4444" : m.status === "warn" ? "#eab308" : "#22c55e"}`
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{m.name}</span>
                <span
                  style={{
                    color: m.status === "bad" ? "#ef4444" : m.status === "warn" ? "#eab308" : "#22c55e",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {m.value}
                </span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 4 }}>{m.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, marginBottom: 10 }}>
          🎯 WHAT TO WORK ON
        </div>
        {d.workOn.map((w, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <span style={{ color: d.color }}>→</span>
            <span style={{ color: "#cbd5e1", fontSize: 13 }}>{w}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          background: `${d.color}12`,
          border: `1px solid ${d.color}30`,
          borderRadius: 12,
          padding: "12px 16px",
          fontStyle: "italic",
          color: d.color,
          fontSize: 13,
          textAlign: "center"
        }}
      >
        &ldquo;{d.affirmation}&rdquo;
      </div>
    </div>
  );
}

function ExerciseFlashCard({ ex }: { ex: ExerciseFlashView }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0d1f1a 0%, #1a2e28 100%)",
        borderRadius: 20,
        border: "1.5px solid rgba(34,197,94,0.3)",
        padding: 28
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 12, textAlign: "center" }}>{ex.icon}</div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 22, fontFamily: "var(--font-display), serif" }}>
          {ex.name}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6 }}>{ex.desc}</div>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "6px 12px", color: "#22c55e", fontSize: 12 }}>
          ⏱ {ex.freq}
        </span>
        <span
          style={{
            background: `${ex.intensityColor}18`,
            border: `1px solid ${ex.intensityColor}40`,
            borderRadius: 8,
            padding: "6px 12px",
            color: ex.intensityColor,
            fontSize: 12,
            fontWeight: 700
          }}
        >
          {ex.intensity}
        </span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", borderLeft: "3px solid #22d3ee", marginBottom: 16 }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>💡 TIP</div>
        <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6 }}>{ex.tip}</div>
      </div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center" }}>
        Suggested by: <span style={{ color: "#22d3ee" }}>{ex.doctor}</span>
      </div>
    </div>
  );
}

function DoctorFlashCard({ doc }: { doc: DoctorFlashView }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1a0f2e 0%, #2d1b4e 100%)",
        borderRadius: 20,
        border: "1.5px solid rgba(139,92,246,0.3)",
        padding: 28,
        maxHeight: "70vh",
        overflowY: "auto"
      }}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            flexShrink: 0
          }}
        >
          🧑‍⚕️
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, fontFamily: "var(--font-display), serif" }}>
            {doc.name}
          </div>
          <div style={{ color: "#a855f7", fontSize: 13 }}>{doc.spec}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{doc.hospital}</div>
        </div>
      </div>
      <div style={{ background: "rgba(139,92,246,0.15)", borderRadius: 8, padding: "5px 12px", color: "#a855f7", fontSize: 12, display: "inline-block", marginBottom: 14 }}>
        ⭐ {doc.yrs} yrs experience
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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {doc.exercises.map((e, i) => (
            <span key={i} style={{ background: "rgba(34,197,94,0.12)", borderRadius: 8, padding: "4px 10px", color: "#22c55e", fontSize: 12 }}>
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AffirmationFlashCard({ aff }: { aff: AffirmationFlashView }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1e1a0f 0%, #2d2818 100%)",
        borderRadius: 20,
        border: "1.5px solid rgba(251,191,36,0.3)",
        padding: "48px 32px",
        textAlign: "center",
        minHeight: 280,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 16, color: "#fbbf24" }}>{aff.icon}</div>
      <div style={{ color: "rgba(251,191,36,0.6)", fontSize: 11, letterSpacing: 4, marginBottom: 20 }}>{aff.label}</div>
      <div style={{ color: "#fff", fontSize: 22, fontFamily: "var(--font-display), serif", lineHeight: 1.5, fontStyle: "italic" }}>
        &ldquo;{aff.text}&rdquo;
      </div>
    </div>
  );
}

function SectionHeader({ num, title, badge }: { num: string; title: string; badge?: string }) {
  return (
    <div className="hfc-sec-h">
      <div className="hfc-sec-line" />
      <span className="hfc-sec-title">
        {num} · {title}
      </span>
      {badge ? <span className="hfc-sec-badge">{badge}</span> : null}
    </div>
  );
}

export function HealthFlashcardsReport({
  hits,
  carePlan
}: {
  hits: DiseaseHit[];
  carePlan: CarePlan | null;
}) {
  const diseases = useMemo(() => mapDiseaseHits(hits, carePlan), [hits, carePlan]);
  const exercises = useMemo(
    () => (carePlan ? mapExercises(carePlan, carePlan.topDoctors) : []),
    [carePlan]
  );
  const doctors = useMemo(() => (carePlan ? mapDoctors(carePlan) : []), [carePlan]);
  const affirmations = useMemo(() => (carePlan ? mapAffirmations(carePlan) : []), [carePlan]);

  const [popup, setPopup] = useState<{
    cards: DiseaseFlashView[] | ExerciseFlashView[] | DoctorFlashView[] | AffirmationFlashView[];
    startIndex: number;
    render: (item: unknown) => ReactNode;
  } | null>(null);

  if (hits.length === 0 && !carePlan) return null;

  return (
    <div className="hfc-root">
      <p className="muted" style={{ marginBottom: 16, fontSize: 13 }}>
        Click any card to open interactive flashcards · Swipe or use arrow keys to navigate
      </p>

      <div className="hfc-overview">
        <div
          className="hfc-stat"
          onClick={() => diseases.length && setPopup({ cards: diseases, startIndex: 0, render: (d) => <DiseaseFlashCard d={d as DiseaseFlashView} /> })}
          onKeyDown={(e) => e.key === "Enter" && diseases.length && setPopup({ cards: diseases, startIndex: 0, render: (d) => <DiseaseFlashCard d={d as DiseaseFlashView} /> })}
          role="button"
          tabIndex={0}
        >
          <div className="hfc-stat-v" style={{ color: "var(--acc)" }}>
            {diseases.length}
          </div>
          <div className="hfc-stat-l">Detected diseases</div>
        </div>
        <div
          className="hfc-stat"
          onClick={() =>
            exercises.length &&
            setPopup({ cards: exercises, startIndex: 0, render: (e) => <ExerciseFlashCard ex={e as ExerciseFlashView} /> })
          }
          role="button"
          tabIndex={0}
        >
          <div className="hfc-stat-v" style={{ color: "#22c55e" }}>
            {exercises.length}
          </div>
          <div className="hfc-stat-l">Exercises</div>
        </div>
        <div
          className="hfc-stat"
          onClick={() =>
            doctors.length &&
            setPopup({ cards: doctors, startIndex: 0, render: (d) => <DoctorFlashCard doc={d as DoctorFlashView} /> })
          }
          role="button"
          tabIndex={0}
        >
          <div className="hfc-stat-v" style={{ color: "#a855f7" }}>
            {doctors.length}
          </div>
          <div className="hfc-stat-l">Specialists</div>
        </div>
        <div
          className="hfc-stat"
          onClick={() =>
            affirmations.length &&
            setPopup({
              cards: affirmations,
              startIndex: 0,
              render: (a) => <AffirmationFlashCard aff={a as AffirmationFlashView} />
            })
          }
          role="button"
          tabIndex={0}
        >
          <div className="hfc-stat-v" style={{ color: "#fbbf24" }}>
            {affirmations.length}
          </div>
          <div className="hfc-stat-l">Affirmations</div>
        </div>
        <div className="hfc-stat" style={{ cursor: "default" }}>
          <div className="hfc-stat-v" style={{ color: "var(--acc)", fontSize: 20 }}>
            ↻
          </div>
          <div className="hfc-stat-l">Daily refresh</div>
        </div>
      </div>

      {diseases.length > 0 && (
        <section className="hfc-sec">
          <SectionHeader num="01" title="DETECTED DISEASES" badge="KEYWORD MATCH" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diseases.map((d, i) => (
              <div
                key={d.id}
                className="hfc-row-card"
                onClick={() =>
                  setPopup({
                    cards: diseases,
                    startIndex: i,
                    render: (item) => <DiseaseFlashCard d={item as DiseaseFlashView} />
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPopup({
                      cards: diseases,
                      startIndex: i,
                      render: (item) => <DiseaseFlashCard d={item as DiseaseFlashView} />
                    });
                  }
                }}
              >
                <div className="hfc-row-bar">
                  <div className="hfc-row-top">
                    <span className="hfc-row-name">{d.name}</span>
                    <span className="hfc-row-pct" style={{ color: d.color }}>
                      {d.pct}%
                    </span>
                  </div>
                  <div className="hfc-bar-track">
                    <div className="hfc-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                  </div>
                  <div className="hfc-row-kw">{d.keywords.join(" · ")}</div>
                </div>
                <span className="hfc-chevron">›</span>
              </div>
            ))}
          </div>
          <p className="hfc-hint">Click any disease for biomarkers, what to work on, and an affirmation</p>
        </section>
      )}

      {carePlan && exercises.length > 0 && (
        <section className="hfc-sec">
          <SectionHeader num="02" title="EXERCISES" badge="SYNTHETIC CARE PLAN" />
          <div className="hfc-grid">
            {exercises.map((ex, i) => (
              <div
                key={ex.id}
                className="hfc-tile"
                onClick={() =>
                  setPopup({
                    cards: exercises,
                    startIndex: i,
                    render: (item) => <ExerciseFlashCard ex={item as ExerciseFlashView} />
                  })
                }
                role="button"
                tabIndex={0}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{ex.icon}</div>
                <div style={{ color: "var(--txt)", fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                <div style={{ color: "var(--txt3)", fontSize: 11, marginTop: 6 }}>{ex.freq}</div>
                <div
                  style={{
                    marginTop: 10,
                    display: "inline-block",
                    background: `${ex.intensityColor}18`,
                    border: `1px solid ${ex.intensityColor}40`,
                    borderRadius: 6,
                    padding: "3px 8px",
                    color: ex.intensityColor,
                    fontSize: 10,
                    fontWeight: 700
                  }}
                >
                  {ex.intensity}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {carePlan && doctors.length > 0 && (
        <section className="hfc-sec">
          <SectionHeader num="03" title="TOP SPECIALISTS" badge="FICTIONAL · DATE-SEEDED" />
          <div className="hfc-grid hfc-grid-sm">
            {doctors.map((doc, i) => (
              <div
                key={doc.id}
                className="hfc-tile"
                style={{ textAlign: "left" }}
                onClick={() =>
                  setPopup({
                    cards: doctors,
                    startIndex: i,
                    render: (item) => <DoctorFlashCard doc={item as DoctorFlashView} />
                  })
                }
                role="button"
                tabIndex={0}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>🧑‍⚕️</div>
                <div style={{ color: "var(--txt)", fontWeight: 600, fontSize: 13 }}>{doc.name}</div>
                <div style={{ color: "#a855f7", fontSize: 11, marginTop: 4 }}>{doc.spec}</div>
                <div style={{ color: "var(--txt3)", fontSize: 11, marginTop: 4 }}>{doc.hospital}</div>
                <div style={{ color: "var(--txt3)", fontSize: 11, marginTop: 6 }}>⭐ {doc.yrs} yrs</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {carePlan && affirmations.length > 0 && (
        <section className="hfc-sec">
          <SectionHeader num="04" title="POSITIVE MANIFESTATIONS" badge="MINDFULNESS" />
          <div className="hfc-grid">
            {affirmations.map((a, i) => (
              <div
                key={i}
                className="hfc-tile"
                style={{ textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start" }}
                onClick={() =>
                  setPopup({
                    cards: affirmations,
                    startIndex: i,
                    render: (item) => <AffirmationFlashCard aff={item as AffirmationFlashView} />
                  })
                }
                role="button"
                tabIndex={0}
              >
                <span style={{ color: "#fbbf24", fontSize: 18 }}>{a.icon}</span>
                <div>
                  <div style={{ color: "rgba(251,191,36,0.6)", fontSize: 10, letterSpacing: 2 }}>{a.label}</div>
                  <div style={{ color: "var(--txt2)", fontSize: 12, fontStyle: "italic", lineHeight: 1.5, marginTop: 4 }}>
                    {a.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {carePlan?.disclaimers?.length ? (
        <div className="disc">
          {carePlan.disclaimers.map((d) => (
            <div key={d}>— {d}</div>
          ))}
        </div>
      ) : (
        <div className="disc">
          All doctors, hospitals, and medications are SYNTHETIC and fictional. Not medical advice — consult a qualified
          clinician.
        </div>
      )}

      {popup && (
        <FlashcardPopup
          cards={popup.cards}
          startIndex={popup.startIndex}
          onClose={() => setPopup(null)}
          renderCard={popup.render}
        />
      )}
    </div>
  );
}
