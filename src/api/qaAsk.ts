import { AnswerSource, persistAnswerSafe } from "../answers/persist.js";
import {
  answerQ2HomeRemediesThenDoctors,
  answerQ3DoctorsForStage,
  answerQ4HealthReportDiseaseCureSolution
} from "../answers/manualFlows.js";
import { answerQuestionByBankSlug, answerQuestionWithWebRag } from "../rag/dynamicWebRag.js";

export type UnifiedAskSuccess = {
  success: true;
  /** Machine-readable handler id */
  type:
    | "web_rag"
    | "bank_rag"
    | "manual_q2"
    | "manual_q3"
    | "manual_q4";
  /** Full tool response (same shape as MCP / legacy routes) */
  data: unknown;
};

export type UnifiedAskFailure = {
  success: false;
  error: string;
};

export type UnifiedAskResult = UnifiedAskSuccess | UnifiedAskFailure;

/**
 * Single entrypoint for demo hosting: ask a question → get an answer.
 *
 * Priority:
 * 1. `manualId` q2 / q3 / q4 → structured manual flows
 * 2. `slug` matching `qb_XXX` → trained bank RAG
 * 3. `question` (non-empty string) → Wikipedia RAG (free-form)
 */
export async function executeUnifiedAsk(raw: unknown): Promise<UnifiedAskResult> {
  if (!raw || typeof raw !== "object") {
    return { success: false, error: "Expected JSON body." };
  }

  const body = raw as Record<string, unknown>;

  const manualId = body.manualId;
  if (manualId === "q2" || manualId === "q3" || manualId === "q4") {
    try {
      if (manualId === "q2") {
        const diseaseSlug = String(body.diseaseSlug ?? "").trim();
        if (!diseaseSlug) {
          return {
            success: false,
            error: 'manualId "q2" requires diseaseSlug (e.g. "diabetes").'
          };
        }
        const data = answerQ2HomeRemediesThenDoctors(diseaseSlug);
        persistAnswerSafe({ source: AnswerSource.MANUAL_Q2, payload: data });
        return { success: true, type: "manual_q2", data };
      }
      if (manualId === "q3") {
        const diseaseSlug = String(body.diseaseSlug ?? "").trim();
        const st = body.stage;
        if (!diseaseSlug) {
          return {
            success: false,
            error: 'manualId "q3" requires diseaseSlug and stage (1, 2, or 3).'
          };
        }
        if (st !== 1 && st !== 2 && st !== 3) {
          return { success: false, error: 'manualId "q3" requires stage: 1 | 2 | 3.' };
        }
        const data = answerQ3DoctorsForStage(diseaseSlug, st as 1 | 2 | 3);
        persistAnswerSafe({ source: AnswerSource.MANUAL_Q3, payload: data });
        return { success: true, type: "manual_q3", data };
      }
      const pdfText =
        typeof body.pdfText === "string" ? body.pdfText : undefined;
      const pdfBase64 =
        typeof body.pdfBase64 === "string" ? body.pdfBase64 : undefined;
      if (!pdfText?.trim() && !pdfBase64?.trim()) {
        return {
          success: false,
          error: 'manualId "q4" requires pdfText or pdfBase64.'
        };
      }
      const data = await answerQ4HealthReportDiseaseCureSolution({
        pdfText,
        pdfBase64
      });
      persistAnswerSafe({ source: AnswerSource.MANUAL_Q4, payload: data });
      return { success: true, type: "manual_q4", data };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Manual flow failed.";
      return { success: false, error: msg };
    }
  }

  const slugRaw = typeof body.slug === "string" ? body.slug.trim() : "";
  if (slugRaw && /^qb_\d{3}$/.test(slugRaw)) {
    try {
      const refresh = body.refresh === true;
      const data = await answerQuestionByBankSlug(slugRaw, { refresh });
      return { success: true, type: "bank_rag", data };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Bank RAG failed.";
      return { success: false, error: msg };
    }
  }

  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (question.length >= 3) {
    try {
      const refresh = body.refresh === true;
      const data = await answerQuestionWithWebRag(question, { refresh });
      return { success: true, type: "web_rag", data };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Web RAG failed.";
      return { success: false, error: msg };
    }
  }

  return {
    success: false,
    error:
      "Send one of: { \"question\": \"…\" } (Wikipedia RAG), " +
      "{ \"slug\": \"qb_001\" } (bank RAG after training), " +
      "or { \"manualId\": \"q2\"|\"q3\"|\"q4\", … } — see GET /api/qa/info."
  };
}

/** Static discovery payload for judges / Postman. */
export function getUnifiedAskApiInfo() {
  return {
    service: "MCPServer QA API",
    unifiedAsk: {
      method: "POST",
      paths: ["/api/qa/ask", "/api/v1/ask"],
      description:
        "One endpoint to ask anything: free-form English (RAG), bank slug (qb_XXX), or manual q2/q3/q4.",
      examples: [
        {
          label: "Free-form Wikipedia RAG",
          body: { question: "What is hypertension?", refresh: false }
        },
        {
          label: "Bank slug (train first: npm run db:train-bank)",
          body: { slug: "qb_003", refresh: false }
        },
        {
          label: "Manual q2 — remedies + doctors",
          body: { manualId: "q2", diseaseSlug: "diabetes" }
        },
        {
          label: "Manual q3 — doctors by stage",
          body: { manualId: "q3", diseaseSlug: "lung-cancer", stage: 2 }
        },
        {
          label: "Manual q4 — report text",
          body: { manualId: "q4", pdfText: "Patient has elevated HbA1c..." }
        }
      ]
    },
    related: {
      catalog: "GET /api/rag/catalog",
      answersLog: "GET /api/answers",
      questionsDb: "GET /api/questions",
      health: "GET /api/health"
    }
  };
}
