import Link from "next/link";
import type { DiseaseSummary } from "../lib/types";

async function getDiseases(): Promise<DiseaseSummary[]> {
  const base = (process.env.MCP_API_BASE_URL ?? "http://127.0.0.1:3333").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/diseases`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { diseases: DiseaseSummary[] };
    return data.diseases;
  } catch {
    // Backend not running, wrong port, or Windows localhost quirks — page still loads.
    return [];
  }
}

export default async function HomePage() {
  const diseases = await getDiseases();
  const groups: Record<string, DiseaseSummary[]> = {
    imaging: [],
    clinical: [],
    signal: []
  };
  for (const d of diseases) groups[d.category]?.push(d);

  return (
    <div>
      <section className="hero">
        <h1>20 Disease Detection Tools</h1>
        <p>
          Each disease is exposed as an MCP tool and a REST endpoint. The pipeline runs{" "}
          <strong>detection → resolution → solution</strong> — synthetic data only, no
          real PHI.
        </p>
      </section>

      <CategorySection title="Imaging-based" diseases={groups.imaging ?? []} />
      <CategorySection title="Clinical / tabular" diseases={groups.clinical ?? []} />
      <CategorySection title="Signal-based" diseases={groups.signal ?? []} />
    </div>
  );
}

function CategorySection({
  title,
  diseases
}: {
  title: string;
  diseases: DiseaseSummary[];
}) {
  if (diseases.length === 0) return null;
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="grid">
        {diseases.map((d) => (
          <Link key={d.slug} href={`/diseases/${d.slug}`} className="card">
            <h3>{d.name}</h3>
            <div className="muted">{d.description}</div>
            <div style={{ marginTop: 10 }}>
              <span className="tag">{d.modality}</span>
              <span className="tag">{d.modelKind}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
