import { createHash } from "node:crypto";

export function normalizeQuestionText(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

/** Stable slug per question text so repeat asks reuse the same corpus row. */
export function questionSlugFromText(q: string): string {
  const n = normalizeQuestionText(q).toLowerCase();
  const h = createHash("sha256").update(n, "utf8").digest("hex").slice(0, 24);
  return `q_${h}`;
}
