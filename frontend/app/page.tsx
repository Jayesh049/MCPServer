import { DiseaseHubPage } from "../components/DiseaseHubPage";
import { getDiseaseSummaries } from "../lib/fetch-diseases";

export default async function HomePage() {
  const diseases = await getDiseaseSummaries();
  return <DiseaseHubPage diseases={diseases} />;
}
