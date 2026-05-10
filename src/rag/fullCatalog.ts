import { MANUAL_QUESTIONS } from "../questions/catalogManual.js";
import { RAG_QUESTION_BANK_100 } from "../questions/bank100.js";

/** Unified catalog: manual flows (q2–q4) first, then the 100 Wikipedia-RAG bank prompts. */
export function getFullRagCatalog() {
  return {
    manualQuestionsFirst: MANUAL_QUESTIONS.map((m) => ({
      kind: "manual-flow" as const,
      id: m.id,
      title: m.title,
      prompt: m.prompt
    })),
    bankQuestions: RAG_QUESTION_BANK_100.map((q, i) => ({
      kind: "wikipedia-rag-bank" as const,
      order: i + 1,
      slug: q.slug,
      prompt: q.prompt
    })),
    counts: {
      manual: MANUAL_QUESTIONS.length,
      bank: RAG_QUESTION_BANK_100.length,
      totalListed: MANUAL_QUESTIONS.length + RAG_QUESTION_BANK_100.length
    }
  };
}
