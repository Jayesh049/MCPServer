import type { RiskLevel } from "../lib/types";

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`risk-pill ${risk}`}>{risk}</span>;
}
