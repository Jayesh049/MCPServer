"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { fetchCarePlan } from "../../lib/api";
import { diseaseIcon } from "../../lib/disease-icons";
import type { DiseaseSummary } from "../../lib/types";

export function StunningDiseaseHub({ diseases }: { diseases: DiseaseSummary[] }) {
  const router = useRouter();
  const imaging = diseases.filter((d) => d.category === "imaging").length;
  const clinical = diseases.filter((d) => d.category === "clinical").length;
  const realModels = useMemo(
    () =>
      diseases.filter(
        (d) =>
          d.category === "clinical" &&
          (d.modelKind === "self-trained" || d.slug === "diabetes")
      ).length,
    [diseases]
  );

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
          <div className="sec-sub">Click any disease to instantly load its synthetic care plan</div>
        </div>
        <span className="src-pill">⚡ /api/diseases</span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-v">{diseases.length}</div>
          <div className="stat-l">Supported diseases</div>
          <div className="stat-c">
            {imaging} imaging · {clinical} clinical
          </div>
        </div>
        <div className="stat">
          <div className="stat-v">{realModels || 6}</div>
          <div className="stat-l">Real risk models</div>
          <div className="stat-c">Framingham · CKD-EPI · NAFLD</div>
        </div>
        <div className="stat">
          <div className="stat-v">Daily</div>
          <div className="stat-l">Care plan refresh</div>
          <div className="stat-c">Date-seeded RNG</div>
        </div>
      </div>

      <div className="dg">
        {diseases.map((d, i) => (
          <button
            key={d.slug}
            type="button"
            className="dc"
            style={{
              animation: `stunning-fadeUp 0.3s ease both ${i * 0.03}s`
            }}
            onClick={() => void pickDisease(d.slug, d.name)}
          >
            <div className="dc-icon" style={{ animationDelay: `${i * 0.2}s` }}>
              {diseaseIcon(d.slug, d.category)}
            </div>
            <div className="dc-n">{d.name}</div>
            <div className="dc-c">{d.category}</div>
          </button>
        ))}
      </div>

      <p className="disc" style={{ marginTop: 16 }}>
        Or open the full <Link href="/diseases/diabetes" style={{ color: "var(--acc)" }}>detector tester</Link> for
        imaging uploads and clinical forms.
      </p>
    </>
  );
}
