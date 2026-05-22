"use client";

import { useState } from "react";
import type { DiseaseHit } from "../lib/types";
import { RiskBadge } from "./RiskBadge";
import { ReportFlashCards } from "./ReportFlashCards";

export function ReportDetectedList({
  detected,
  primarySlug,
}: {
  detected: DiseaseHit[];
  primarySlug?: string;
}) {
  const [secondarySlug, setSecondarySlug] = useState<string | null>(null);

  if (detected.length === 0) {
    return (
      <p className="subtle" style={{ margin: 0 }}>
        No disease keywords found. Try a report with clearer clinical terms (labs, diagnoses, impressions).
      </p>
    );
  }

  const primary = detected.find((d) => d.slug === primarySlug) ?? detected[0];

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {primary ? (
        <p className="subtle" style={{ margin: 0 }}>
          Primary: <strong>{primary.name}</strong> (<code>{primary.slug}</code>) — match strength{" "}
          {(primary.score * 100).toFixed(0)}%
          {primary.riskLevel ? (
            <>
              {" "}
              <RiskBadge risk={primary.riskLevel} />
            </>
          ) : null}
        </p>
      ) : null}

      <ul className="list" style={{ margin: 0 }}>
        {detected.map((d) => (
          <li key={d.slug} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <strong>{d.name}</strong>
              <span className="subtle">({d.slug})</span>
              <span>{(d.score * 100).toFixed(0)}% match</span>
              {d.riskLevel ? <RiskBadge risk={d.riskLevel} /> : null}
              {d.slug !== primarySlug && (
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() =>
                    setSecondarySlug((s) => (s === d.slug ? null : d.slug))
                  }
                >
                  {secondarySlug === d.slug ? "Hide care plan" : "View care plan"}
                </button>
              )}
            </div>
            <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
              Evidence: {d.evidence.join(", ")}
            </div>
          </li>
        ))}
      </ul>

      {secondarySlug ? (
        <div style={{ marginTop: 8 }}>
          <p className="subtle" style={{ fontSize: 12, marginBottom: 12 }}>
            Care plan for secondary finding: <strong>{secondarySlug}</strong> (synthetic demo data)
          </p>
          <ReportFlashCards carePlan={null} diseaseSlug={secondarySlug} />
        </div>
      ) : null}
    </div>
  );
}
