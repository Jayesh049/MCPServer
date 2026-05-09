import type { DiseasePipelineResult } from "../lib/types";
import { RiskBadge } from "./RiskBadge";

export function ResultPanels({ data }: { data: DiseasePipelineResult }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="panel">
        <h2>1. Detection</h2>
        <div className="kv">
          <div className="k">Classification</div>
          <div>
            <strong>{data.detection.classification}</strong>
          </div>
          <div className="k">Confidence</div>
          <div>{(data.detection.confidence * 100).toFixed(1)}%</div>
          <div className="k">Risk</div>
          <div>
            <RiskBadge risk={data.detection.riskLevel} />
          </div>
          <div className="k">Rationale</div>
          <div className="subtle">{data.detection.rationale}</div>
        </div>
        {data.detection.signals?.length > 0 && (
          <>
            <div className="section-title">Signals</div>
            <div className="kv">
              {data.detection.signals.map((s) => (
                <FragmentRow key={s.label} k={s.label} v={String(s.value)} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <h2>2. Resolution</h2>
        <div className="subtle" style={{ marginBottom: 8 }}>
          Recommended steps for risk level: <strong>{data.resolution.forRiskLevel}</strong>
        </div>
        <ol className="list">
          {data.resolution.steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="panel">
        <h2>3. Solution</h2>
        <div className="section-title">Immediate actions</div>
        <ul className="list">
          {data.solution.immediateActions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <div className="section-title">Follow-up</div>
        <ul className="list">
          {data.solution.followUp.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <div className="section-title">Patient education</div>
        <ul className="list">
          {data.solution.patientEducation.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="k">{k}</div>
      <div>{v}</div>
    </>
  );
}
