import Link from "next/link";
import { getDiseaseSummaries } from "../../../lib/fetch-diseases";
import { DetectorTester } from "./DetectorTester";

export default async function DiseasePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const list = await getDiseaseSummaries();
  const disease = list.find((d) => d.slug === slug);

  if (!disease) {
    return (
      <div className="page-hero-compact">
        <p>Unknown disease: {slug}</p>
        <Link href="/" className="btn secondary" style={{ marginTop: 12, display: "inline-flex" }}>
          ← Back to all diseases
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="back-row">
        <Link href="/" className="subtle">
          ← All diseases
        </Link>
      </div>
      <section className="hero">
        <div className="hero-eyebrow">Disease pipeline</div>
        <h1>{disease.name}</h1>
        <p className="hero-sub">{disease.description}</p>
        <div className="hero-meta" style={{ marginTop: 8 }}>
          <span className="card-tag">{disease.modality}</span>
          <span className="card-tag">{disease.modelKind}</span>
        </div>
        <p className="subtle" style={{ marginTop: 14, maxWidth: 640 }}>
          {disease.modelNotes}
        </p>
      </section>

      <DetectorTester disease={disease} />
    </div>
  );
}
