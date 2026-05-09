import type { RiskLevel } from "../lib/types";

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`pill ${risk}`}>Risk: {risk}</span>;
}
