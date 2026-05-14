import type { DiseasePipelineResult } from "../lib/types";
import { RiskBadge } from "./RiskBadge";

export function ResultPanels({ data }: { data: DiseasePipelineResult }) {
  return (
    <div className="result-cards">
      <div className="result-card">
        <div className="result-card-label step-detect">
          <span className="step-num">1</span>
          Detection
        </div>
        <div className="kv-grid">
          <div className="kv-k">Classification</div>
          <div>
            <strong>{data.detection.classification}</strong>
          </div>
          <div className="kv-k">Confidence</div>
          <div>
            {(data.detection.confidence * 100).toFixed(1)}%
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{ width: `${Math.min(100, data.detection.confidence * 100)}%` }}
              />
            </div>
          </div>
          <div className="kv-k">Risk</div>
          <div>
            <RiskBadge risk={data.detection.riskLevel} />
          </div>
          <div className="kv-k">Rationale</div>
          <div className="muted">{data.detection.rationale}</div>
        </div>
        {data.detection.signals?.length > 0 && (
          <>
            <div className="det-section-title" style={{ marginTop: 16 }}>
              Signals
            </div>
            <div className="kv-grid">
              {data.detection.signals.map((s) => (
                <FragmentRow key={s.label} k={s.label} v={String(s.value)} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="result-card">
        <div className="result-card-label step-resolve">
          <span className="step-num">2</span>
          Resolution
        </div>
        <p className="muted" style={{ marginBottom: 10 }}>
          Recommended steps for risk level: <strong>{data.resolution.forRiskLevel}</strong>
        </p>
        <ol className="step-list">
          {data.resolution.steps.map((step, idx) => (
            <li key={idx} data-n={String(idx + 1)}>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="result-card">
        <div className="result-card-label step-solve">
          <span className="step-num">3</span>
          Solution
        </div>
        <div className="det-section-title" style={{ marginTop: 0 }}>
          Immediate actions
        </div>
        <ol className="step-list">
          {data.solution.immediateActions.map((s, i) => (
            <li key={i} data-n={String(i + 1)}>
              {s}
            </li>
          ))}
        </ol>
        <div className="det-section-title">Follow-up</div>
        <ol className="step-list">
          {data.solution.followUp.map((s, i) => (
            <li key={i} data-n={String(i + 1)}>
              {s}
            </li>
          ))}
        </ol>
        <div className="det-section-title">Patient education</div>
        <ol className="step-list">
          {data.solution.patientEducation.map((s, i) => (
            <li key={i} data-n={String(i + 1)}>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="kv-k">{k}</div>
      <div>{v}</div>
    </>
  );
}
