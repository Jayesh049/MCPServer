import type { DiseasePipelineResult } from "../../lib/types";

const RISK_CLASS: Record<string, string> = {
  low: "it-l",
  medium: "it-m",
  high: "it-h"
};

export function StunningResultPanels({ data }: { data: DiseasePipelineResult }) {
  const confPct = Math.min(100, data.detection.confidence * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="pipe-card">
        <div className="sec-lbl">01 · Detection</div>
        <div className="hi" style={{ marginBottom: 10 }}>
          <div className="hi-bar">
            <div className="hi-fill" style={{ width: `${confPct}%` }} />
          </div>
          <div className="hi-score">{confPct.toFixed(1)}%</div>
          <div>
            <div className="hi-n">{data.detection.classification}</div>
            <div className="hi-e">Confidence score</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span className="src-pill dim">Risk</span>
          <span className={`itag ${RISK_CLASS[data.detection.riskLevel] ?? "it-m"}`}>
            {data.detection.riskLevel}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.55 }}>{data.detection.rationale}</p>
        {data.detection.signals?.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <div className="src-pill dim" style={{ marginBottom: 8 }}>
              Signals
            </div>
            <div className="hl">
              {data.detection.signals.map((s) => (
                <div key={s.label} className="hi">
                  <div style={{ flex: 1 }}>
                    <div className="hi-n">{s.label}</div>
                    <div className="hi-e">{String(s.value)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="pipe-card">
        <div className="sec-lbl">02 · Resolution</div>
        <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 10 }}>
          Steps for risk level: <strong style={{ color: "var(--txt)" }}>{data.resolution.forRiskLevel}</strong>
        </p>
        <ol className="pipe-list">
          {data.resolution.steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="pipe-card">
        <div className="sec-lbl">03 · Solution</div>
        <div style={{ marginBottom: 12 }}>
          <div className="src-pill dim" style={{ marginBottom: 8 }}>
            Immediate actions
          </div>
          <ol className="pipe-list">
            {data.solution.immediateActions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div className="src-pill dim" style={{ marginBottom: 8 }}>
            Follow-up
          </div>
          <ol className="pipe-list">
            {data.solution.followUp.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div>
          <div className="src-pill dim" style={{ marginBottom: 8 }}>
            Patient education
          </div>
          <ol className="pipe-list">
            {data.solution.patientEducation.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
