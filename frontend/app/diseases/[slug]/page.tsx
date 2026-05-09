import Link from "next/link";
import type { DiseaseSummary } from "../../../lib/types";
import { DetectorTester } from "./DetectorTester";

async function getDiseases(): Promise<DiseaseSummary[]> {
  const base = process.env.MCP_API_BASE_URL ?? "http://localhost:3333";
  const res = await fetch(`${base}/api/diseases`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { diseases: DiseaseSummary[] };
  return data.diseases;
}

export default async function DiseasePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const list = await getDiseases();
  const disease = list.find((d) => d.slug === slug);

  if (!disease) {
    return (
      <div>
        <p>Unknown disease: {slug}</p>
        <Link href="/" className="btn secondary" style={{ marginTop: 12 }}>
          ← Back to all diseases
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/" className="subtle">
          ← All diseases
        </Link>
      </div>
      <section className="hero">
        <h1>{disease.name}</h1>
        <p>{disease.description}</p>
        <div style={{ marginTop: 10 }}>
          <span className="tag">{disease.modality}</span>
          <span className="tag">{disease.modelKind}</span>
        </div>
        <p className="subtle" style={{ marginTop: 8 }}>
          {disease.modelNotes}
        </p>
      </section>

      <DetectorTester disease={disease} />
    </div>
  );
}
