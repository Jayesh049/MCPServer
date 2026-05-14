import { cache } from "react";
import type { DiseaseSummary } from "./types";

export const getDiseaseSummaries = cache(async (): Promise<DiseaseSummary[]> => {
  const base = (process.env.MCP_API_BASE_URL ?? "http://127.0.0.1:3333").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/diseases`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { diseases: DiseaseSummary[] };
    return data.diseases;
  } catch {
    return [];
  }
});
