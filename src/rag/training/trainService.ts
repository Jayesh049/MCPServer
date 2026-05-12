import { prisma } from "../../lib/prisma.js";
import { runTrainQuestionBank } from "./trainQuestionBank.js";

type RunHandle = {
  startedAt: string;
  promise: Promise<void>;
};

let current: RunHandle | null = null;

export function isTrainingRunning(): boolean {
  return current !== null;
}

/**
 * Starts training in-process (non-blocking for callers that don't await).
 * Safe: only one concurrent run allowed.
 */
export async function startTrainingIfIdle(): Promise<{ started: boolean; runId?: string }> {
  if (current) return { started: false };

  // Create a run row early so callers can poll status.
  const run = await prisma.ragTrainingRun.create({
    data: { label: "question-bank-100", status: "queued" }
  });

  const promise = (async () => {
    await prisma.ragTrainingRun.update({
      where: { id: run.id },
      data: { status: "running" }
    });
    try {
      await runTrainQuestionBank();
    } finally {
      current = null;
    }
  })();

  current = { startedAt: new Date().toISOString(), promise };
  // fire-and-forget (errors are recorded by runTrainQuestionBank)
  void promise.catch(() => {});

  return { started: true, runId: run.id };
}

export async function getLatestTrainingRuns(limit = 10) {
  const take = Math.min(50, Math.max(1, limit));
  return prisma.ragTrainingRun.findMany({
    orderBy: { startedAt: "desc" },
    take
  });
}

