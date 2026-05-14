import type { CSSProperties, ReactNode } from "react";
import type { CarePlan } from "../lib/types";

export function CarePlanPanel({ plan }: { plan: CarePlan }) {
  return (
    <div className="panel" style={{ display: "grid", gap: 18 }}>
      <div>
        <div className="det-section-title" style={{ marginBottom: 8 }}>
          Care Plan (synthetic)
        </div>
        <div className="subtle">
          For known disease: <strong>{plan.diseaseName}</strong>. All doctors, hospitals, and patient details are
          SYNTHETIC and fictional.
        </div>
      </div>

      <Section title="1. Exercises for the healing phase">
        <div className="care-section">
          {plan.exercises.map((ex, i) => (
            <div key={i} className="exercise-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div className="exercise-name">{ex.name}</div>
                <span className={`pill ${intensityRisk(ex.intensity)}`}>{ex.intensity}</span>
              </div>
              <div className="exercise-meta">{ex.description}</div>
              <div className="exercise-meta" style={{ marginTop: 6 }}>
                <span className="kv-k">Frequency:</span> {ex.frequency}
              </div>
              {ex.cautions && ex.cautions.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--warn)" }}>
                  Caution: {ex.cautions.join(" - ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="2. Top 5 doctors - 10 medications each - hospitals">
        <div className="care-section">
          {plan.topDoctors.map((doc, i) => (
            <div key={i} className="exercise-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  gap: 8
                }}
              >
                <div>
                  <strong>{doc.name}</strong> <span className="subtle">- {doc.specialty}</span>
                </div>
                <div className="subtle" style={{ fontSize: 13 }}>
                  {doc.hospital.name} - {doc.hospital.city}, {doc.hospital.country}
                </div>
              </div>
              <div className="exercise-meta" style={{ marginTop: 4 }}>
                {doc.yearsOfExperience} yrs experience - {doc.bio}
              </div>

              <div style={{ overflowX: "auto", marginTop: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                      <th style={cell}>#</th>
                      <th style={cell}>Medication</th>
                      <th style={cell}>Dose</th>
                      <th style={cell}>Schedule</th>
                      <th style={cell}>Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.medications.map((m, j) => (
                      <tr key={j} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={cell}>{j + 1}</td>
                        <td style={cell}>
                          <strong>{m.name}</strong>
                          {m.cautions?.length > 0 && (
                            <div style={{ color: "var(--warn)", fontSize: 12 }}>
                              caution: {m.cautions.join(", ")}
                            </div>
                          )}
                        </td>
                        <td style={cell}>{m.dose}</td>
                        <td style={cell}>{m.schedule}</td>
                        <td style={{ ...cell, color: "var(--muted)" }}>{m.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="3. Positive manifestations for the healing phase">
        <div className="affirmation-grid">
          {plan.affirmations.map((a, i) => (
            <div key={i} className="affirmation-card">
              <div className="affirmation-theme">{a.theme}</div>
              <div className="affirmation-text">&ldquo;{a.statement}&rdquo;</div>
            </div>
          ))}
        </div>
      </Section>

      <div className="subtle" style={{ fontSize: 12 }}>
        {plan.disclaimers.map((d, i) => (
          <div key={i}>- {d}</div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="det-section-title">{title}</div>
      {children}
    </div>
  );
}

const cell: CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "top"
};

function intensityRisk(i: "low" | "moderate" | "high"): string {
  if (i === "high") return "high";
  if (i === "moderate") return "medium";
  return "low";
}
