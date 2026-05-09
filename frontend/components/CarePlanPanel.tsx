import type { CarePlan } from "../lib/types";

export function CarePlanPanel({ plan }: { plan: CarePlan }) {
  return (
    <div className="panel" style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>Care Plan (synthetic)</h2>
        <div className="subtle">
          For known disease: <strong>{plan.diseaseName}</strong>. All doctors,
          hospitals, and patient details are SYNTHETIC and fictional.
        </div>
      </div>

      <Section title="1. Exercises for the healing phase">
        <div style={{ display: "grid", gap: 10 }}>
          {plan.exercises.map((ex, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{ex.name}</strong>
                <span className={`pill ${intensityRisk(ex.intensity)}`}>
                  {ex.intensity}
                </span>
              </div>
              <div className="subtle" style={{ marginTop: 4 }}>
                {ex.description}
              </div>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                <span className="k">Frequency:</span> {ex.frequency}
              </div>
              {ex.cautions && ex.cautions.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 13, color: "#b35a00" }}>
                  Caution: {ex.cautions.join(" - ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="2. Top 5 doctors - 10 medications each - hospitals">
        <div style={{ display: "grid", gap: 14 }}>
          {plan.topDoctors.map((doc, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px"
              }}
            >
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
                  <strong>{doc.name}</strong>{" "}
                  <span className="subtle">- {doc.specialty}</span>
                </div>
                <div className="subtle" style={{ fontSize: 13 }}>
                  {doc.hospital.name} - {doc.hospital.city}, {doc.hospital.country}
                </div>
              </div>
              <div className="subtle" style={{ fontSize: 13, marginTop: 2 }}>
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
                            <div style={{ color: "#b35a00", fontSize: 12 }}>
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10
          }}
        >
          {plan.affirmations.map((a, i) => (
            <div
              key={i}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                background: "rgba(0,0,0,0.02)"
              }}
            >
              <div className="subtle" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {a.theme}
              </div>
              <div style={{ marginTop: 4 }}>{a.statement}</div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-title">{title}</div>
      {children}
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "6px 8px",
  verticalAlign: "top"
};

function intensityRisk(i: "low" | "moderate" | "high"): string {
  if (i === "high") return "high";
  if (i === "moderate") return "medium";
  return "low";
}
