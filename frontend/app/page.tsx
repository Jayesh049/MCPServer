import { StunningDiseaseHub } from "../components/stunning/StunningDiseaseHub";
import { getDiseaseSummaries } from "../lib/fetch-diseases";

export default async function HomePage() {
  const diseases = await getDiseaseSummaries();
  return <StunningDiseaseHub diseases={diseases} />;
}
