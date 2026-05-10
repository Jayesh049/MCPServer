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
