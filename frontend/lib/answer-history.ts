import { apiUrl } from "./api-base";

export type AnswerHistoryRow = {
  id: string;
  source: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export async function fetchAnswerHistory(limit = 25): Promise<AnswerHistoryRow[]> {
  const res = await fetch(`/api/answers?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  const data = (await res.json()) as { answers?: AnswerHistoryRow[] };
  return data.answers ?? [];
}

export async function deleteAnswerHistoryItem(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/answers/${encodeURIComponent(id)}`), {
    method: "DELETE"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Delete failed (${res.status})`);
  }
}

export async function clearAllAnswerHistory(): Promise<number> {
  const res = await fetch(apiUrl("/api/answers"), { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Clear failed (${res.status})`);
  }
  const data = (await res.json()) as { deletedCount?: number };
  return data.deletedCount ?? 0;
}

export function extractQaFromRow(row: AnswerHistoryRow): { question: string; answer: string } {
  const p = row.payload ?? {};
  const question =
    (typeof p.question === "string" && p.question) ||
    (typeof p.message === "string" && p.message) ||
    (typeof p.slug === "string" && p.slug) ||
    "—";
  const answer =
    (typeof p.patientText === "string" && p.patientText) ||
    (typeof p.answerPreview === "string" && p.answerPreview) ||
    (typeof p.geminiAnswer === "string" && p.geminiAnswer) ||
    (typeof p.answer === "string" && p.answer) ||
    "";
  return { question, answer };
}
