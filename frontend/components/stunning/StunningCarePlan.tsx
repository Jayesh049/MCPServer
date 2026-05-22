"use client";

import { useState } from "react";
import type { Affirmation, CarePlan, Doctor } from "../../lib/types";

const INTENSITY_CLASS: Record<string, string> = {
  low: "it-l",
  moderate: "it-m",
  high: "it-h"
};

const AFFIRMATION_ICON: Record<string, string> = {
  presence: "✦",
  agency: "◈",
  support: "⬡",
  compassion: "♡",
  hope: "◎",
  rest: "◌",
  trust: "✧",
  celebration: "◆"
};

function affirmationIcon(theme: string): string {
  return AFFIRMATION_ICON[theme.toLowerCase()] ?? "◇";
}

export function StunningCarePlan({ plan }: { plan: CarePlan }) {
  const [doctorIdx, setDoctorIdx] = useState<number | null>(null);
  const doctor = doctorIdx !== null ? plan.topDoctors[doctorIdx] : null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="sec-lbl">
          01 · Personal Health Overview{" "}
          <span className="src-pill" style={{ marginLeft: 4 }}>
            /api/diseases/:slug/care-plan
          </span>
        </div>
        <div className="hs">
          <div className="hs-d">{plan.diseaseName}</div>
          <div className="hs-g">
            <div className="hs-c">
              <div className="hs-v">{plan.exercises.length}</div>
              <div className="hs-l">Exercises</div>
            </div>
            <div className="hs-c">
              <div className="hs-v">{plan.topDoctors.length}</div>
              <div className="hs-l">Specialists</div>
            </div>
            <div className="hs-c">
              <div className="hs-v">{plan.affirmations.length}</div>
              <div className="hs-l">Affirmations</div>
            </div>
            <div className="hs-c">
              <div className="hs-v" style={{ fontSize: 14, color: "var(--acc)" }}>
                ↻ Daily
              </div>
              <div className="hs-l">Plan refresh</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="sec-lbl">
          02 · Exercises <span className="src-pill dim">synthetic care plan · daily refresh</span>
        </div>
        <div className="car">
          {plan.exercises.map((e) => (
            <div key={e.name} className="fc">
              <div className="fc-icon">🏃</div>
              <div className="fc-t">{e.name}</div>
              <div className="fc-b">{e.description}</div>
              <div className="fc-f">⏱ {e.frequency}</div>
              <span className={`itag ${INTENSITY_CLASS[e.intensity] ?? "it-l"}`}>{e.intensity}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="sec-lbl">
          03 · Top 3 Specialists <span className="src-pill dim">fictional · date-seeded</span>
        </div>
        <div className="car">
          {plan.topDoctors.map((d, i) => (
            <button key={d.name} type="button" className="doc-c" onClick={() => setDoctorIdx(i)}>
              <div className="doc-av">👨‍⚕️</div>
              <div className="doc-n">{d.name}</div>
              <div className="doc-sp">{d.specialty}</div>
              <div className="doc-h">
                {d.hospital.name} · {d.hospital.city}
              </div>
              <span className="doc-xp">⭐ {d.yearsOfExperience} yrs</span>
              <span className="doc-btn">View full profile →</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="sec-lbl">
          04 · Positive Manifestations <span className="src-pill gold">mindfulness · care plan</span>
        </div>
        <div className="car">
          {plan.affirmations.map((a: Affirmation) => (
            <div key={a.theme + a.statement} className="aff-c">
              <div className="aff-th">
                {affirmationIcon(a.theme)} {a.theme}
              </div>
              <p className="aff-q">&ldquo;{a.statement}&rdquo;</p>
            </div>
          ))}
        </div>
      </div>

      <div className="disc">
        {plan.disclaimers.map((d) => (
          <div key={d}>— {d}</div>
        ))}
      </div>

      {doctor ? (
        <DoctorModal doctor={doctor} onClose={() => setDoctorIdx(null)} />
      ) : null}
    </div>
  );
}

function DoctorModal({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  return (
    <div className="mo-wrap" style={{ display: "flex" }}>
      <div className="mo" role="dialog" aria-labelledby="doc-modal-title">
        <div className="mo-h">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="doc-av" style={{ width: 44, height: 44, fontSize: 20 }}>
              👨‍⚕️
            </div>
            <div>
              <div
                id="doc-modal-title"
                style={{
                  fontFamily: "var(--font-display), serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--txt)"
                }}
              >
                {doctor.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--rose)" }}>{doctor.specialty}</div>
              <div style={{ fontSize: 11, color: "var(--txt3)" }}>
                {doctor.hospital.name} · {doctor.hospital.city}, {doctor.hospital.country}
              </div>
            </div>
          </div>
          <button type="button" className="mo-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="mo-b">
          <div
            style={{
              fontSize: 12,
              color: "var(--txt2)",
              lineHeight: 1.55,
              background: "rgba(79,209,199,.06)",
              border: "1px solid var(--bdr)",
              borderRadius: "var(--r2)",
              padding: "10px 12px",
              marginBottom: 14
            }}
          >
            {doctor.bio}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginBottom: 14
            }}
          >
            <div className="hs-c">
              <div className="hs-v">{doctor.yearsOfExperience}</div>
              <div className="hs-l">Yrs exp.</div>
            </div>
            <div className="hs-c">
              <div className="hs-v">10</div>
              <div className="hs-l">Medications</div>
            </div>
            <div className="hs-c">
              <div className="hs-v">{doctor.hospital.city}</div>
              <div className="hs-l">Location</div>
            </div>
          </div>
          <div
            style={{
              fontSize: "9.5px",
              fontWeight: 600,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--txt3)",
              marginBottom: 8
            }}
          >
            Suggested Medications{" "}
            <span className="src-pill rose" style={{ marginLeft: 4, verticalAlign: "middle" }}>
              illustrative only
            </span>
          </div>
          <table className="med-t">
            <thead>
              <tr>
                <th>#</th>
                <th>Medication</th>
                <th>Dose · Schedule</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {doctor.medications.map((m, j) => (
                <tr key={m.name + j}>
                  <td style={{ color: "var(--txt3)" }}>{j + 1}</td>
                  <td>
                    <div className="med-nm">{m.name}</div>
                    {m.cautions.length > 0 ? (
                      <div className="med-cau">⚠ {m.cautions.join(", ")}</div>
                    ) : null}
                  </td>
                  <td>
                    {m.dose} · {m.schedule}
                  </td>
                  <td style={{ color: "var(--txt3)" }}>{m.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="disc" style={{ marginTop: 10 }}>
            All details SYNTHETIC. Not clinical advice.
          </div>
        </div>
      </div>
    </div>
  );
}
