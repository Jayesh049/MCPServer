import type { Prisma } from "@prisma/client";
import { AnswerSource } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export { AnswerSource };

/** Persist a generated answer row for audit/demo (`Answer` model). */
export async function persistAnswer(args: {
  questionId?: string | null;
  source: AnswerSource;
  payload: unknown;
}) {
  return prisma.answer.create({
    data: {
      questionId: args.questionId ?? undefined,
      source: args.source,
      payload: args.payload as Prisma.InputJsonValue
    }
  });
}

/** Fire-and-forget; logs errors without throwing to callers. */
export function persistAnswerSafe(args: Parameters<typeof persistAnswer>[0]) {
  void persistAnswer(args).catch((e) => {
    console.warn("[persistAnswer]", e);
  });
}

/** Remove one stored answer row (patient history). */
export async function deleteAnswerById(id: string): Promise<boolean> {
  const trimmed = id.trim();
  if (!trimmed) return false;
  const result = await prisma.answer.deleteMany({ where: { id: trimmed } });
  return result.count > 0;
}

/** Remove all answer rows (clear patient Q&A history). */
export async function deleteAllAnswers(): Promise<number> {
  const result = await prisma.answer.deleteMany({});
  return result.count;
}
