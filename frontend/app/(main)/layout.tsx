import type { ReactNode } from "react";
import { AppShell } from "../../components/AppShell";
import { getDiseaseSummaries } from "../../lib/fetch-diseases";

export default async function MainAppLayout({ children }: { children: ReactNode }) {
  const diseases = await getDiseaseSummaries();
  return <AppShell diseases={diseases}>{children}</AppShell>;
}
