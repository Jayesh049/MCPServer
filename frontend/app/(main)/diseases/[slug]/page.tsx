import Link from "next/link";
import { getDiseaseSummaries } from "../../../../lib/fetch-diseases";
import { StunningDiseaseDetector } from "../../../../components/stunning/StunningDiseaseDetector";

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
      <>
        <div className="sec-h">
          <div className="sec-title">Unknown disease</div>
          <div className="sec-sub">{slug}</div>
        </div>
        <Link href="/hub" className="btn btn-g" style={{ display: "inline-flex", marginTop: 8 }}>
          ← Disease hub
        </Link>
      </>
    );
  }

  return <StunningDiseaseDetector disease={disease} />;
}
