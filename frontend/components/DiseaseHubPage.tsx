"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DiseaseSummary, ModelKind } from "../lib/types";

function categoryEmoji(category: DiseaseSummary["category"]): string {
  if (category === "imaging") return "👁";
  if (category === "clinical") return "💉";
  return "📈";
}

function badgeForModel(kind: ModelKind): { className: string; label: string } {
  if (kind === "open-source-pretrained") {
    return { className: "open-source", label: "Open Source" };
  }
  if (kind === "self-trained") {
    return { className: "self-trained", label: "Self-Trained" };
  }
  return { className: "stub", label: "Stub" };
}

function PipelineDecor() {
  return (
    <div className="hero-pipeline" aria-hidden>
      <div className="pipeline-step detect">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        Detection
      </div>
      <div className="pipeline-step resolve">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        Resolution
      </div>
      <div className="pipeline-step solve">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M9 12l2 2 4-4" />
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
        </svg>
        Solution
      </div>
    </div>
  );
}

function DiseaseCard({ d }: { d: DiseaseSummary }) {
  const badge = badgeForModel(d.modelKind);
  return (
    <Link
      href={`/diseases/${d.slug}`}
      className={`disease-card ${d.category}`}
      data-name={d.name.toLowerCase()}
    >
      <div className="card-top">
        <div className={`card-icon ${d.category}`}>{categoryEmoji(d.category)}</div>
        <div className={`card-badge ${badge.className}`}>{badge.label}</div>
      </div>
      <div className="card-name">{d.name}</div>
      <div className="card-desc">{d.description}</div>
      <div className="card-footer">
        <span className="card-tag">{d.modality}</span>
        <span className="card-tag">{d.modelKind}</span>
        <span className="card-arrow">→</span>
      </div>
    </Link>
  );
}

export function DiseaseHubPage({ diseases }: { diseases: DiseaseSummary[] }) {
  const [q, setQ] = useState("");
  const [imagingFilter, setImagingFilter] = useState<"all" | ModelKind>("all");

  const imaging = useMemo(
    () => diseases.filter((d) => d.category === "imaging"),
    [diseases]
  );
  const clinical = useMemo(
    () => diseases.filter((d) => d.category === "clinical"),
    [diseases]
  );
  const signal = useMemo(() => diseases.filter((d) => d.category === "signal"), [diseases]);

  const n = diseases.length;
  const modalities = [imaging.length > 0, clinical.length > 0, signal.length > 0].filter(Boolean).length;

  function matches(d: DiseaseSummary): boolean {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      d.name.toLowerCase().includes(s) ||
      d.description.toLowerCase().includes(s) ||
      d.slug.toLowerCase().includes(s) ||
      d.modelKind.toLowerCase().includes(s)
    );
  }

  const imagingFiltered = useMemo(() => {
    return imaging.filter((d) => {
      if (!matches(d)) return false;
      if (imagingFilter === "all") return true;
      return d.modelKind === imagingFilter;
    });
  }, [imaging, q, imagingFilter]);

  const clinicalFiltered = useMemo(() => clinical.filter(matches), [clinical, q]);
  const signalFiltered = useMemo(() => signal.filter(matches), [signal, q]);

  return (
    <div>
      <div className="hero">
        <div className="hero-eyebrow">Healthcare AI Platform</div>
        <h1>
          20 Disease Detection <em>Pipelines</em>
        </h1>
        <p className="hero-sub">
          Each disease is exposed as an MCP tool and REST endpoint. Detection → Resolution → Solution — synthetic data
          only, no real PHI.
        </p>
        <div className="hero-meta">
          <div className="hero-stat">
            <span className="hero-stat-num">{n || "—"}</span>
            <span className="hero-stat-label">diseases</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num">{modalities || "—"}</span>
            <span className="hero-stat-label">modalities</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num">∞</span>
            <span className="hero-stat-label">synthetic samples</span>
          </div>
          <PipelineDecor />
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-cell">
          <div className="stat-val">{imaging.length}</div>
          <div className="stat-lbl">Imaging models</div>
          <div className="stat-trend up">↑ CNN-based</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val">{clinical.length}</div>
          <div className="stat-lbl">Clinical / tabular</div>
          <div className="stat-trend neutral">biomarker inputs</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val">{signal.length}</div>
          <div className="stat-lbl">Signal-based</div>
          <div className="stat-trend neutral">ECG / SpO₂</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val">3</div>
          <div className="stat-lbl">Pipeline stages</div>
          <div className="stat-trend up">↑ detect→resolve→solve</div>
        </div>
      </div>

      <div className="search-wrap">
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden>
            🔍
          </span>
          <input
            className="search-input"
            type="search"
            placeholder="Search diseases…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search diseases"
          />
        </div>
      </div>

      {imagingFiltered.length > 0 ? (
        <>
          <div className="section-header" id="header-imaging">
            <div className="section-title-group">
              <div className="section-heading">Imaging-based</div>
              <span className="section-pill imaging">CNN / Vision</span>
            </div>
            <div className="filter-row">
              <button
                type="button"
                className={`filter-btn${imagingFilter === "all" ? " active" : ""}`}
                onClick={() => setImagingFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-btn${imagingFilter === "open-source-pretrained" ? " active" : ""}`}
                onClick={() => setImagingFilter("open-source-pretrained")}
              >
                Open source
              </button>
              <button
                type="button"
                className={`filter-btn${imagingFilter === "self-trained" ? " active" : ""}`}
                onClick={() => setImagingFilter("self-trained")}
              >
                Self-trained
              </button>
            </div>
          </div>
          <div className="disease-grid">
            {imagingFiltered.map((d) => (
              <DiseaseCard key={d.slug} d={d} />
            ))}
          </div>
        </>
      ) : null}

      {clinicalFiltered.length > 0 ? (
        <>
          <div className="section-header" id="header-clinical">
            <div className="section-title-group">
              <div className="section-heading">Clinical / Tabular</div>
              <span className="section-pill clinical">Biomarkers</span>
            </div>
          </div>
          <div className="disease-grid">
            {clinicalFiltered.map((d) => (
              <DiseaseCard key={d.slug} d={d} />
            ))}
          </div>
        </>
      ) : null}

      {signalFiltered.length > 0 ? (
        <>
          <div className="section-header" id="header-signal">
            <div className="section-title-group">
              <div className="section-heading">Signal-based</div>
              <span className="section-pill signal">ECG / SpO₂</span>
            </div>
          </div>
          <div className="disease-grid">
            {signalFiltered.map((d) => (
              <DiseaseCard key={d.slug} d={d} />
            ))}
          </div>
        </>
      ) : null}

      {n === 0 ? (
        <div className="disease-grid" style={{ paddingTop: 0 }}>
          <div className="result-card" style={{ gridColumn: "1 / -1" }}>
            <p className="muted" style={{ margin: 0 }}>
              No diseases loaded. Start the MCP API (see <code>DEV-CHAT.md</code>) so{" "}
              <code>MCP_API_BASE_URL</code> returns <code>/api/diseases</code>.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
