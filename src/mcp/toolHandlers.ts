import { tools } from "./tools.js";
import { requireFhirContext, SharpContextError } from "../sharp/context.js";
import { getPatientFacts } from "../fhir/adapter.js";
import { extractSignals } from "../llm/extract.js";
import { computeCareGapTable } from "../domain/computeCareGaps.js";
import { CareGapTableSchema } from "../domain/careGaps.js";
import { runDiseasePipeline } from "../diseases/registry.js";
import { buildCarePlan } from "../care/carePlan.js";
import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { analyzeReportText } from "../report/analyzeReport.js";
import { answerQuestionByBankSlug, answerQuestionWithWebRag } from "../rag/dynamicWebRag.js";
import {
  answerQ2HomeRemediesThenDoctors,
  answerQ3DoctorsForStage,
  answerQ4HealthReportDiseaseCureSolution
} from "../answers/manualFlows.js";
import { AnswerSource, persistAnswer, persistAnswerSafe } from "../answers/persist.js";
import { prisma } from "../lib/prisma.js";
import { callAgentBankRag, callAgentWebRag, isAgentRagEnabled } from "./agentRagClient.js";
import {
  diseaseCorpusIngest,
  diseaseCorpusModels,
  diseaseCorpusPredict,
  diseaseCorpusTrain,
  isDiseaseMlEnabled
} from "../ml/flaskDiseaseClient.js";

export type ToolCallInput = {
  toolName: string;
  toolArguments: unknown;
  meta: unknown;
};

async function persistRagPayloadFromAgent(result: unknown) {
  if (!result || typeof result !== "object") return;
  const r = result as Record<string, unknown>;
  const slug = typeof r.slug === "string" ? r.slug : "";
  if (!slug) return;
  const row = await prisma.question.findUnique({ where: { slug }, select: { id: true } });
  if (!row) return;
  try {
    await persistAnswer({
      questionId: row.id,
      source: /^qb_/.test(slug) ? AnswerSource.BANK_RAG : AnswerSource.WEB_RAG,
      payload: result
    });
  } catch (e) {
    console.warn("[persistRagPayloadFromAgent]", e);
  }
}

export async function handleToolCall(input: ToolCallInput) {
  const tool = tools.find((t) => t.name === input.toolName);
  if (!tool) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Unknown tool: ${input.toolName}`
        }
      ]
    };
  }

  let fhirContext: ReturnType<typeof requireFhirContext> | undefined;
  if (tool.requiresFhirContext !== false) {
    try {
      fhirContext = requireFhirContext(input.meta);
    } catch (e) {
      const message =
        e instanceof SharpContextError ? e.message : "Missing required FHIR context.";
      return {
        isError: true,
        content: [{ type: "text", text: message }]
      };
    }
  }

  const args = tool.inputZod.parse(input.toolArguments ?? {});

  try {
    if (tool.domain === "disease-ml") {
      if (!isDiseaseMlEnabled()) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "DISEASE_ML_URL is not set; disease corpus ML tools are disabled. Deploy ml/flask_disease and set the URL (see ml/flask_disease/README.md)."
            }
          ]
        };
      }
      if (input.toolName === "disease_corpus_ml_ingest") {
        const { diseaseSlug, functionality, files, trainingLabel } = args as {
          diseaseSlug: string;
          functionality?: string;
          files: Array<{
            filename: string;
            mimeType: string;
            dataBase64: string;
            trainingLabel?: 0 | 1;
          }>;
          trainingLabel?: 0 | 1;
        };
        const result = await diseaseCorpusIngest(diseaseSlug, {
          functionality,
          files: files.map((f) => ({
            filename: f.filename,
            mimeType: f.mimeType,
            dataBase64: f.dataBase64,
            trainingLabel: f.trainingLabel ?? trainingLabel
          })),
          trainingLabel
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      if (input.toolName === "disease_corpus_ml_train") {
        const { diseaseSlug, functionality, formulaKey, hyperparams } = args as {
          diseaseSlug: string;
          functionality?: string;
          formulaKey?: string;
          hyperparams?: Record<string, unknown>;
        };
        const result = await diseaseCorpusTrain(diseaseSlug, {
          functionality,
          formulaKey,
          hyperparams
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      if (input.toolName === "disease_corpus_ml_models") {
        const { diseaseSlug, functionality } = args as { diseaseSlug: string; functionality?: string };
        const result = await diseaseCorpusModels(diseaseSlug, functionality);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      if (input.toolName === "disease_corpus_ml_predict") {
        const { diseaseSlug, functionality, text } = args as {
          diseaseSlug: string;
          functionality?: string;
          text: string;
        };
        const result = await diseaseCorpusPredict(diseaseSlug, { functionality, text });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      return {
        isError: true,
        content: [{ type: "text", text: `Unhandled disease-ml tool: ${input.toolName}` }]
      };
    }

    if (tool.domain === "manual-question") {
      if (input.toolName === "manual_q2_home_remedies_doctors") {
        const { diseaseSlug } = args as { diseaseSlug: string };
        const result = answerQ2HomeRemediesThenDoctors(diseaseSlug);
        persistAnswerSafe({ source: AnswerSource.MANUAL_Q2, payload: result });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      if (input.toolName === "manual_q3_stage_doctors") {
        const { diseaseSlug, stage } = args as { diseaseSlug: string; stage: 1 | 2 | 3 };
        const result = answerQ3DoctorsForStage(diseaseSlug, stage);
        persistAnswerSafe({ source: AnswerSource.MANUAL_Q3, payload: result });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      if (input.toolName === "manual_q4_health_report_outline") {
        const body = args as { pdfText?: string; pdfBase64?: string };
        const result = await answerQ4HealthReportDiseaseCureSolution(body);
        persistAnswerSafe({ source: AnswerSource.MANUAL_Q4, payload: result });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    }

    if (tool.domain === "rag-web") {
      if (input.toolName === "ask_bank_rag") {
        const { slug, refresh } = args as { slug: string; refresh?: boolean };
        let result: unknown;
        if (isAgentRagEnabled()) {
          result = await callAgentBankRag(slug, refresh);
          await persistRagPayloadFromAgent(result);
        } else {
          result = await answerQuestionByBankSlug(slug, { refresh });
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }
      const { question, refresh } = args as { question: string; refresh?: boolean };
      let result: unknown;
      if (isAgentRagEnabled()) {
        result = await callAgentWebRag(question, refresh);
        await persistRagPayloadFromAgent(result);
      } else {
        result = await answerQuestionWithWebRag(question, { refresh });
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }

    // ---------- Care-gap tools ----------
    if (input.toolName === "get_patient_facts") {
      const facts = await getPatientFacts(fhirContext!, args as any);
      return {
        content: [{ type: "text", text: JSON.stringify(facts, null, 2) }]
      };
    }

    if (input.toolName === "identify_care_gaps") {
      const facts = await getPatientFacts(fhirContext!);
      const signals = extractSignals({ facts, noteText: (args as any).noteText });
      return {
        content: [{ type: "text", text: JSON.stringify({ facts, signals }, null, 2) }]
      };
    }

    if (input.toolName === "compute_risk_table") {
      const { facts, extractedSignals } = args as any;
      const table = computeCareGapTable({
        patientId: fhirContext!.patientId ?? "unknown",
        facts,
        signals: extractedSignals
      });
      return { content: [{ type: "text", text: JSON.stringify(table, null, 2) }] };
    }

    if (input.toolName === "render_output_table") {
      const { table } = args as any;
      const validated = CareGapTableSchema.parse(table);
      return { content: [{ type: "text", text: JSON.stringify(validated, null, 2) }] };
    }

    // ---------- Disease tools ----------
    if (tool.domain === "disease" && tool.diseaseSlug) {
      const result = await runDiseasePipeline(tool.diseaseSlug, args as any);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }

    // ---------- Care plan tool ----------
    if (input.toolName === "care_plan_for_disease") {
      const { diseaseSlug } = args as { diseaseSlug: string };
      const plan = buildCarePlan(diseaseSlug);
      return {
        content: [{ type: "text", text: JSON.stringify(plan, null, 2) }]
      };
    }

    // ---------- Report analysis tool ----------
    if (input.toolName === "analyze_patient_report_pdf") {
      const { pdfBase64, pdfText } = args as { pdfBase64?: string; pdfText?: string };
      if (pdfText && String(pdfText).trim().length > 0) {
        const analysis = analyzeReportText(String(pdfText));
        return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
      }
      if (!pdfBase64) {
        return {
          isError: true,
          content: [{ type: "text", text: "Missing pdfBase64 (or pdfText)." }]
        };
      }
      const extracted = await extractTextFromPdfBase64(String(pdfBase64));
      const analysis = analyzeReportText(extracted.text, extracted.pages);
      return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Tool not implemented: ${input.toolName}` }]
    };
  } catch (e: any) {
    return {
      isError: true,
      content: [{ type: "text", text: e?.message ? String(e.message) : "Tool failed." }]
    };
  }
}
