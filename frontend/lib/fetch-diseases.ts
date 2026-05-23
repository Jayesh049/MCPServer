import { cache } from "react";
import type { DiseaseSummary } from "./types";
import { getServerApiBase } from "./api-base";

export const getDiseaseSummaries = cache(async (): Promise<DiseaseSummary[]> => {
  const base = getServerApiBase();
  try {
    const res = await fetch(`${base}/api/diseases`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { diseases: DiseaseSummary[] };
    return data.diseases;
  } catch {
    return [];
  }
});
