"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { fetchCarePlan } from "../../lib/api";
import { diseaseIcon } from "../../lib/disease-icons";
import { trainingPill } from "../../lib/disease-training-pill";
import type { DiseaseSummary } from "../../lib/types";

function HubAccordion({
  id,
  emoji,
  title,
  subtitle,
  badge,
  badgeClass,
  diseases,
  onPick,
  footnote
}: {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeClass: string;
  diseases: DiseaseSummary[];
  onPick: (slug: string, name: string) => void;
  footnote?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hub-sec">
      <button
        type="button"
        className={`hub-head${open ? " op" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
      >
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hub-title">{title}</div>
          <div className="hub-sub">{subtitle}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span className={`src-pill ${badgeClass}`}>{badge}</span>
          <span className="hub-arrow">▶</span>
        </div>
      </button>
      <div className={`hub-body${open ? " op" : ""}`} id={id}>
        <div className="hub-grid">
          {diseases.map((d) => {
            const pill = trainingPill(d);
            return (
              <button key={d.slug} type="button" className="dc" onClick={() => onPick(d.slug, d.name)}>
                <div className="dc-icon">{diseaseIcon(d.slug, d.category)}</div>
                <div className="dc-name">{d.name}</div>
                <div className="dc-meta">
                  <span className="dc-cat">{d.category}</span>
                  <span className={`tp ${pill.className}`}>{pill.label}</span>
                </div>
              </button>
            );
          })}
        </div>
        {footnote}
      </div>
    </div>
  );
}

export function StunningDiseaseHub({ diseases }: { diseases: DiseaseSummary[] }) {
  const router = useRouter();
  const imaging = useMemo(() => diseases.filter((d) => d.category === "imaging"), [diseases]);
  const clinical = useMemo(() => diseases.filter((d) => d.category === "clinical"), [diseases]);
  const signal = useMemo(() => diseases.filter((d) => d.category === "signal"), [diseases]);

  const realFormulas = clinical.filter((d) => d.modelKind !== "stub").length;
  const trainedImaging = imaging.filter((d) => d.modelKind === "self-trained").length;

  async function pickDisease(slug: string, name: string) {
    try {
      const plan = await fetchCarePlan(slug);
      sessionStorage.setItem(
        "stunning_hub_pick",
        JSON.stringify({
          slug,
          name,
          plan,
          hits: [
            {
              slug,
              name,
              score: 1,
              evidence: ["Loaded from disease hub"],
              evidenceSnippets: []
            }
          ]
        })
      );
      router.push("/report?from=hub");
    } catch {
      router.push(`/report?slug=${encodeURIComponent(slug)}`);
    }
  }

  return (
    <>
      <div className="sec-h">
        <div>
          <div className="sec-title">Disease Hub</div>
          <div className="sec-sub">
            Click a section to expand. Every disease shows its training status and data source.
          </div>
        </div>
        <span className="src-pill">⚡ /api/diseases</span>
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat">
          <div className="stat-v">{diseases.length}</div>
          <div className="stat-l">Total diseases</div>
          <div className="stat-c">
            {imaging.length} imaging · {clinical.length} clinical · {signal.length} signal
          </div>
        </div>
        <div className="stat">
          <div className="stat-v">{realFormulas || 6}</div>
          <div className="stat-l">Real formula models</div>
          <div className="stat-c">Framingham · CKD-EPI · NAFLD</div>
        </div>
        <div className="stat">
          <div className="stat-v">{trainedImaging || 10}</div>
          <div className="stat-l">Sklearn imaging</div>
          <div className="stat-c">train:imaging · HF for pneumonia</div>
        </div>
        <div className="stat">
          <div className="stat-v">Daily</div>
          <div className="stat-l">Care plan refresh</div>
          <div className="stat-c">Date-seeded RNG</div>
        </div>
      </div>

      <HubAccordion
        id="hb-img"
        emoji="🔬"
        title={`Imaging Diseases (${imaging.length})`}
        subtitle="Brain MRI · Chest X-ray · Retinal · Skin · CT"
        badge={trainedImaging > 0 ? `✓ ${trainedImaging} sklearn trained` : "Run train:imaging"}
        badgeClass={trainedImaging > 0 ? "pill-ok" : "pill-warn"}
        diseases={imaging}
        onPick={(slug, name) => void pickDisease(slug, name)}
        footnote={
          <div className="disc" style={{ margin: "0 16px 16px" }}>
            <strong style={{ color: "var(--gold)" }}>Imaging note:</strong> Run{" "}
            <code>npm run train:imaging:all</code> for real upload predictions. Pneumonia uses{" "}
            <code>HF_API_TOKEN</code> (ViT) or a labeled brightness stub. See{" "}
            <a href="/about" style={{ color: "var(--acc)" }}>
              About
            </a>{" "}
            for all credentials.
          </div>
        }
      />

      <HubAccordion
        id="hb-clin"
        emoji="🩺"
        title={`Clinical Diseases (${clinical.length})`}
        subtitle="Validated formula-based risk scoring on form fields"
        badge="✓ Real formulas · isStub: false"
        badgeClass="pill-ok"
        diseases={clinical}
        onPick={(slug, name) => void pickDisease(slug, name)}
        footnote={
          <div style={{ padding: "0 16px 14px", fontSize: 11.5, color: "var(--txt3)", lineHeight: 1.55 }}>
            Clinical models use validated scoring formulas (not trained on PHI). Open{" "}
            <Link href="/diseases/diabetes" style={{ color: "var(--acc)" }}>
              detector tester
            </Link>{" "}
            for full detection → resolution → solution.
          </div>
        }
      />

      <HubAccordion
        id="hb-sig"
        emoji="📡"
        title={`Signal / Heuristic (${signal.length})`}
        subtitle="Rule-based scoring, no trained model"
        badge="Hand-tuned rules"
        badgeClass="pill-dim-hub"
        diseases={signal}
        onPick={(slug, name) => void pickDisease(slug, name)}
      />
    </>
  );
}
