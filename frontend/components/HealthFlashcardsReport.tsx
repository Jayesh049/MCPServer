"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="hfc-pp-dots">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`hfc-pp-dot${i < current ? " done" : ""}${i === current ? " active" : ""}`} />
      ))}
    </div>
  );
}

function DeckHeader({
  sectionNum,
  title,
  pill
}: {
  sectionNum: string;
  title: string;
  pill?: string;
}) {
  return (
    <div className="hfc-sec-head">
      <div className="hfc-sec-line" />
      <div className="hfc-sec-num">{sectionNum}</div>
      <div className="hfc-sec-name">{title}</div>
      {pill ? <span className="hfc-sec-pill">{pill}</span> : null}
    </div>
  );
}

function PopupNav({
  index,
  total,
  onPrev,
  onNext
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="hfc-pc-nav">
      <button type="button" className="hfc-nav-btn" onClick={onPrev} disabled={index === 0}>
        ← Previous
      </button>
      <button type="button" className="hfc-nav-btn next" onClick={onNext} disabled={index >= total - 1}>
        Next →
      </button>
    </div>
  );
}

function DiseasePopupBody({ d }: { d: DiseaseFlashView }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.width = "0%";
    const t = window.setTimeout(() => {
      el.style.width = `${d.pct}%`;
    }, 80);
    return () => window.clearTimeout(t);
  }, [d.id, d.pct]);

  return (
    <>
      <div className="hfc-risk-bar-wrap">
        <div className="hfc-rb-label">
          <span>Match confidence</span>
          <span style={{ fontWeight: 600 }}>{d.pct}%</span>
        </div>
        <div className="hfc-rb-track">
          <div ref={barRef} className={`hfc-rb-fill ${d.risk}`} />
        </div>
      </div>
      <div className="hfc-acronym-block">
        <div className="hfc-ab-head">What do these terms mean?</div>
        {d.acronyms.map((a) => (
          <div key={a.term} className="hfc-ac-item">
            <span className="hfc-ac-term">{a.term}</span>
            <span className="hfc-ac-meaning">{a.meaning}</span>
          </div>
        ))}
      </div>
      <div className="hfc-work-heading">What to work on</div>
      <div className="hfc-work-grid">
        {d.work.map((w) => (
          <div key={`${w.title}-${w.label}`} className={`hfc-wk-card ${w.severity}`}>
            <div className="hfc-wk-lbl">{w.label}</div>
            <div className="hfc-wk-title">{w.title}</div>
            <div className="hfc-wk-desc">{w.desc}</div>
          </div>
        ))}
      </div>
      <div className="hfc-affirmation-inner" style={{ marginTop: "0.75rem" }}>
        <div className="hfc-aff-theme">Daily affirmation</div>
        <div className="hfc-aff-quote">&ldquo;{d.affirmation}&rdquo;</div>
      </div>
    </>
  );
}

function ExercisePopupBody({ e }: { e: ExerciseFlashView }) {
  return (
    <>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Description</span>
        <span className="hfc-ir-val">{e.desc}</span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Frequency</span>
        <span className="hfc-ir-val">{e.freq}</span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Intensity</span>
        <span className="hfc-ir-val">{e.intensity}</span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Source</span>
        <span className="hfc-ir-val" style={{ color: "var(--acc)" }}>
          {e.src}
        </span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Doctor specialty</span>
        <span className="hfc-ir-val">{e.doctorSpec}</span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Tip</span>
        <span className="hfc-ir-val">{e.tip}</span>
      </div>
    </>
  );
}

function DoctorPopupBody({ doc }: { doc: DoctorFlashView }) {
  return (
    <>
      <div className="hfc-doc-inner">
        <div className="hfc-di-row">
          <div className="hfc-di-av">🧑‍⚕️</div>
          <div>
            <div className="hfc-di-name">{doc.name}</div>
            <div className="hfc-di-spec">{doc.hospital}</div>
          </div>
        </div>
        <div className="hfc-di-bio">{doc.bio}</div>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Experience</span>
        <span className="hfc-ir-val">{doc.yrs} years</span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Consultations</span>
        <span className="hfc-ir-val">{doc.consultations} (illustrative)</span>
      </div>
      <div className="hfc-meds-heading">Suggested medications (illustrative only)</div>
      {doc.meds.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--txt3)" }}>No medications listed for this profile.</p>
      ) : (
        doc.meds.map((m, i) => (
          <div key={m.name} className="hfc-med-row">
            <span className="hfc-med-name">
              {i + 1}. {m.name}
            </span>
            <span className="hfc-med-dose">{m.dose}</span>
          </div>
        ))
      )}
    </>
  );
}

function AffirmationPopupBody({ a }: { a: AffirmationFlashView }) {
  return (
    <>
      <div className="hfc-affirmation-inner">
        <div className="hfc-aff-theme">{a.theme.toUpperCase()}</div>
        <div className="hfc-aff-quote">&ldquo;{a.quote}&rdquo;</div>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Theme</span>
        <span className="hfc-ir-val" style={{ color: "var(--acc)" }}>
          {a.theme}
        </span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">Source</span>
        <span className="hfc-ir-val">Care plan · mindfulness protocol</span>
      </div>
      <div className="hfc-info-row">
        <span className="hfc-ir-label">How to use</span>
        <span className="hfc-ir-val">Read often — morning or evening</span>
      </div>
    </>
  );
}

function usePopupDeck<T extends { id: string }>(items: T[]) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [closing, setClosing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const openAt = useCallback((i: number) => {
    if (!items[i]) return;
    setIndex(i);
    setActiveId(items[i].id);
    setClosing(false);
    setOpen(true);
    window.requestAnimationFrame(() => {
      overlayRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [items]);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setActiveId(null);
      const cards = gridRef.current?.querySelectorAll(".hfc-home-card");
      cards?.forEach((c, i) => {
        c.classList.remove("active-source");
        c.classList.remove("card-returned");
        void (c as HTMLElement).offsetWidth;
        (c as HTMLElement).style.animation = `hfcCardReturn 0.35s cubic-bezier(0.34, 1.2, 0.64, 1) ${i * 0.05}s both`;
        c.classList.add("card-returned");
      });
    }, 200);
  }, []);

  const go = useCallback(
    (dir: -1 | 1) => {
      const next = index + dir;
      if (next < 0 || next >= items.length) return;
      setIndex(next);
      setActiveId(items[next].id);
      const card = cardRef.current;
      if (card) {
        card.classList.remove("closing");
        card.style.animation = "none";
        void card.offsetWidth;
        card.style.animation = "hfcPopIn 0.22s cubic-bezier(0.34, 1.4, 0.64, 1) both";
      }
    },
    [index, items]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, go]);

  return { open, index, closing, activeId, overlayRef, cardRef, gridRef, openAt, close, go };
}

function DiseaseDeck({ diseases }: { diseases: DiseaseFlashView[] }) {
  const deck = usePopupDeck(diseases);
  const d = diseases[deck.index];

  return (
    <div className="hfc-deck-section">
      <DeckHeader sectionNum="01" title="Detected diseases" pill="keyword match" />
      <div className="hfc-deck-label">👆 Click any card to view full details in the popup</div>

      <div ref={deck.overlayRef} className={`hfc-popup-overlay${deck.open ? " open" : ""}`}>
        {d && (
          <div ref={deck.cardRef} className={`hfc-popup-card${deck.closing ? " closing" : ""}`}>
            <div className="hfc-pc-rainbow" />
            <div className="hfc-pc-head">
              <div className="hfc-pc-head-left">
                <div className="hfc-pc-av">{d.icon}</div>
                <div>
                  <div className="hfc-pc-title">{d.name}</div>
                  <div className="hfc-pc-subtitle">
                    Match: {d.pct}% · Risk: {d.risk}
                  </div>
                </div>
              </div>
              <button type="button" className="hfc-close-btn" onClick={deck.close} aria-label="Close">
                ×
              </button>
            </div>
            <div className="hfc-pc-body">
              <div className="hfc-pc-progress">
                <ProgressDots total={diseases.length} current={deck.index} />
                <span className="hfc-pp-count">
                  {deck.index + 1} / {diseases.length}
                </span>
              </div>
              <DiseasePopupBody d={d} />
            </div>
            <PopupNav
              index={deck.index}
              total={diseases.length}
              onPrev={() => deck.go(-1)}
              onNext={() => deck.go(1)}
            />
          </div>
        )}
      </div>

      <div ref={deck.gridRef} className="hfc-card-grid">
        {diseases.map((item, i) => (
          <div
            key={item.id}
            className={`hfc-home-card${deck.activeId === item.id ? " active-source" : ""}`}
            onClick={() => deck.openAt(i)}
            onKeyDown={(e) => e.key === "Enter" && deck.openAt(i)}
            role="button"
            tabIndex={0}
          >
            <span className="hfc-hc-icon">{item.icon}</span>
            <div className="hfc-hc-title">{item.name}</div>
            <div className="hfc-hc-sub">{item.keywords.slice(0, 3).join(" · ")}</div>
            <span className={`hfc-hc-badge ${item.badge}`}>
              {item.badgeText} · {item.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseDeck({ exercises }: { exercises: ExerciseFlashView[] }) {
  const deck = usePopupDeck(exercises);
  const e = exercises[deck.index];

  return (
    <div className="hfc-deck-section">
      <DeckHeader sectionNum="02" title="Exercises" pill="synthetic · daily refresh" />
      <div className="hfc-deck-label">👆 Click an exercise card for full details</div>

      <div ref={deck.overlayRef} className={`hfc-popup-overlay${deck.open ? " open" : ""}`}>
        {e && (
          <div ref={deck.cardRef} className={`hfc-popup-card${deck.closing ? " closing" : ""}`}>
            <div className="hfc-pc-rainbow" />
            <div className="hfc-pc-head">
              <div className="hfc-pc-head-left">
                <div className="hfc-pc-av">{e.icon}</div>
                <div>
                  <div className="hfc-pc-title">{e.name}</div>
                  <div className="hfc-pc-subtitle">{e.freq}</div>
                </div>
              </div>
              <button type="button" className="hfc-close-btn" onClick={deck.close} aria-label="Close">
                ×
              </button>
            </div>
            <div className="hfc-pc-body">
              <div className="hfc-pc-progress">
                <ProgressDots total={exercises.length} current={deck.index} />
                <span className="hfc-pp-count">
                  {deck.index + 1} / {exercises.length}
                </span>
              </div>
              <ExercisePopupBody e={e} />
            </div>
            <div className="hfc-rag-note">
              📚 Source: care plan synthesis · illustrative exercise guidance — not a prescription.
            </div>
            <PopupNav
              index={deck.index}
              total={exercises.length}
              onPrev={() => deck.go(-1)}
              onNext={() => deck.go(1)}
            />
          </div>
        )}
      </div>

      <div ref={deck.gridRef} className="hfc-card-grid">
        {exercises.map((item, i) => (
          <div
            key={item.id}
            className={`hfc-home-card${deck.activeId === item.id ? " active-source" : ""}`}
            onClick={() => deck.openAt(i)}
            onKeyDown={(ev) => ev.key === "Enter" && deck.openAt(i)}
            role="button"
            tabIndex={0}
          >
            <span className="hfc-hc-icon">{item.icon}</span>
            <div className="hfc-hc-title">{item.name}</div>
            <div className="hfc-hc-sub">{item.desc}</div>
            <span className={`hfc-hc-badge ${item.intensityBadge}`}>{item.intensity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DoctorDeck({ doctors }: { doctors: DoctorFlashView[] }) {
  const deck = usePopupDeck(doctors);
  const doc = doctors[deck.index];

  return (
    <div className="hfc-deck-section">
      <DeckHeader sectionNum="03" title="Top specialists" pill="fictional · date-seeded" />
      <div className="hfc-deck-label">👆 Click a doctor card for profile and medications</div>

      <div ref={deck.overlayRef} className={`hfc-popup-overlay${deck.open ? " open" : ""}`}>
        {doc && (
          <div ref={deck.cardRef} className={`hfc-popup-card${deck.closing ? " closing" : ""}`}>
            <div className="hfc-pc-rainbow" />
            <div className="hfc-pc-head">
              <div className="hfc-pc-head-left">
                <div className="hfc-pc-av">🩺</div>
                <div>
                  <div className="hfc-pc-title">{doc.name}</div>
                  <div className="hfc-pc-subtitle">{doc.spec}</div>
                </div>
              </div>
              <button type="button" className="hfc-close-btn" onClick={deck.close} aria-label="Close">
                ×
              </button>
            </div>
            <div className="hfc-pc-body">
              <div className="hfc-pc-progress">
                <ProgressDots total={doctors.length} current={deck.index} />
                <span className="hfc-pp-count">
                  {deck.index + 1} / {doctors.length}
                </span>
              </div>
              <DoctorPopupBody doc={doc} />
            </div>
            <div className="hfc-rag-note">
              📚 Source: date-seeded synthetic profiles · not clinical advice.
            </div>
            <PopupNav
              index={deck.index}
              total={doctors.length}
              onPrev={() => deck.go(-1)}
              onNext={() => deck.go(1)}
            />
          </div>
        )}
      </div>

      <div ref={deck.gridRef} className="hfc-card-grid">
        {doctors.map((item, i) => (
          <div
            key={item.id}
            className={`hfc-home-card${deck.activeId === item.id ? " active-source" : ""}`}
            onClick={() => deck.openAt(i)}
            onKeyDown={(ev) => ev.key === "Enter" && deck.openAt(i)}
            role="button"
            tabIndex={0}
          >
            <span className="hfc-hc-icon">🩺</span>
            <div className="hfc-hc-title">{item.name}</div>
            <div className="hfc-hc-sub">
              {item.spec} · {item.hospital.split("·")[0]?.trim()}
            </div>
            <span className="hfc-hc-badge teal">{item.yrs} yrs experience</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AffirmationDeck({ affirmations }: { affirmations: AffirmationFlashView[] }) {
  const deck = usePopupDeck(affirmations);
  const a = affirmations[deck.index];

  return (
    <div className="hfc-deck-section">
      <DeckHeader sectionNum="04" title="Positive manifestations" pill="mindfulness · care plan" />
      <div className="hfc-deck-label">👆 Each card is a daily affirmation — click to read</div>

      <div ref={deck.overlayRef} className={`hfc-popup-overlay${deck.open ? " open" : ""}`}>
        {a && (
          <div ref={deck.cardRef} className={`hfc-popup-card${deck.closing ? " closing" : ""}`}>
            <div className="hfc-pc-rainbow" />
            <div className="hfc-pc-head">
              <div className="hfc-pc-head-left">
                <div className="hfc-pc-av" style={{ background: "rgba(234, 179, 8, 0.12)" }}>
                  {a.sym}
                </div>
                <div>
                  <div className="hfc-pc-title">{a.theme}</div>
                  <div className="hfc-pc-subtitle">Positive manifestation — daily reminder</div>
                </div>
              </div>
              <button type="button" className="hfc-close-btn" onClick={deck.close} aria-label="Close">
                ×
              </button>
            </div>
            <div className="hfc-pc-body">
              <div className="hfc-pc-progress">
                <ProgressDots total={affirmations.length} current={deck.index} />
                <span className="hfc-pp-count">
                  {deck.index + 1} / {affirmations.length}
                </span>
              </div>
              <AffirmationPopupBody a={a} />
            </div>
            <PopupNav
              index={deck.index}
              total={affirmations.length}
              onPrev={() => deck.go(-1)}
              onNext={() => deck.go(1)}
            />
          </div>
        )}
      </div>

      <div ref={deck.gridRef} className="hfc-card-grid">
        {affirmations.map((item, i) => (
          <div
            key={item.id}
            className={`hfc-home-card${deck.activeId === item.id ? " active-source" : ""}`}
            onClick={() => deck.openAt(i)}
            onKeyDown={(ev) => ev.key === "Enter" && deck.openAt(i)}
            role="button"
            tabIndex={0}
          >
            <span className="hfc-hc-icon">{item.sym}</span>
            <div className="hfc-hc-title">{item.theme}</div>
            <div className="hfc-hc-sub">&ldquo;{item.quote.slice(0, 55)}
              {item.quote.length > 55 ? "…" : ""}&rdquo;
            </div>
            <span className="hfc-hc-badge teal">Mindfulness</span>
          </div>
        ))}
      </div>
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

  if (hits.length === 0 && !carePlan) return null;

  return (
    <div className="hfc-page">
      {diseases.length > 0 && <DiseaseDeck diseases={diseases} />}
      {exercises.length > 0 && <ExerciseDeck exercises={exercises} />}
      {doctors.length > 0 && <DoctorDeck doctors={doctors} />}
      {affirmations.length > 0 && <AffirmationDeck affirmations={affirmations} />}

      {carePlan?.disclaimers?.length ? (
        <div className="hfc-disc-note">
          {carePlan.disclaimers.map((line) => (
            <div key={line}>— {line}</div>
          ))}
        </div>
      ) : (
        <div className="hfc-disc-note">
          — All doctors, hospitals, and patient details are synthetic and fictional.
          <br />
          — Medication names may be real, but doses and regimens are illustrative only — not clinical
          recommendations.
          <br />— Always speak with a qualified clinician before starting or stopping any treatment.
        </div>
      )}
    </div>
  );
}
