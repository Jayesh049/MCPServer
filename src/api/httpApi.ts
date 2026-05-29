import type { IncomingMessage, ServerResponse } from "node:http";
import { listDiseases, runDiseasePipeline } from "../diseases/registry.js";
import { buildCarePlan, shouldAttachCarePlan } from "../care/carePlan.js";
import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { analyzeReportText, analyzeReportTextAsync } from "../report/analyzeReport.js";
import { extractTextFromCsvText, extractTextFromXlsxBase64 } from "../report/tabularText.js";
import { prisma } from "../lib/prisma.js";
import { answerQuestionByBankSlug, answerQuestionWithWebRag } from "../rag/dynamicWebRag.js";
import { getFullRagCatalog } from "../rag/fullCatalog.js";
import {
  AnswerSource,
  deleteAllAnswers,
  deleteAnswerById,
  persistAnswerSafe
} from "../answers/persist.js";
import { MANUAL_QUESTIONS } from "../questions/catalogManual.js";
import {
  answerQ2HomeRemediesThenDoctors,
  answerQ3DoctorsForStage,
  answerQ4HealthReportDiseaseCureSolution
} from "../answers/manualFlows.js";
import { executeUnifiedAsk, getUnifiedAskApiInfo } from "./qaAsk.js";
import { executePatientChat } from "./patientChat.js";
import { handleHealerApiRequest } from "./healerApi.js";
import { handleDoctorPlatformRequest } from "./doctorPlatformApi.js";
import { getTbLexiconMeta, loadTbLexicon } from "../report/tbLexicon.js";
import { isTbSklearnModelAvailable, loadTbSklearnMeta } from "../diseases/predictors/tuberculosisSklearn.js";
import { suggestAyurvedaYogaForDisease } from "../ayurveda/recommend.js";

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-FHIR-Server-URL,X-FHIR-Access-Token,X-Patient-ID"
  );
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  setCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Returns true if the request was handled by the API.
 */
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  if (!req.url) return false;
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (!url.pathname.startsWith("/api/")) return false;

  if (url.pathname.startsWith("/api/platform")) {
    return handleDoctorPlatformRequest(req, res);
  }

  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/diseases") {
    sendJson(res, 200, { diseases: listDiseases() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/diseases/tuberculosis/lexicon") {
    const model = loadTbLexicon();
    sendJson(res, 200, {
      ok: true,
      keywordLexicon: getTbLexiconMeta(),
      sklearnMl: isTbSklearnModelAvailable() ? loadTbSklearnMeta() : null,
      lexicon: model
        ? {
            trainedAt: model.trainedAt,
            sourcePdf: model.sourcePdf,
            sourceCitation: model.sourceCitation,
            logicSummary: model.logicSummary,
            diagnosticPillars: model.diagnosticPillars,
            topTerms: model.weightedTerms.slice(0, 15)
          }
        : null
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "agents-assemble-sharp-mcp",
      time: new Date().toISOString()
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/qa/info") {
    sendJson(res, 200, getUnifiedAskApiInfo());
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/qa/ask" || url.pathname === "/api/v1/ask")) {
    const raw = await readJsonBody(req);
    const result = await executeUnifiedAsk(raw ?? {});
    sendJson(res, result.success ? 200 : 400, result);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/chat/patient") {
    const raw = await readJsonBody(req);
    const result = await executePatientChat(raw ?? {});
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/rag/catalog") {
    sendJson(res, 200, getFullRagCatalog());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/ayurveda/yoga") {
    const diseaseSlug = String(url.searchParams.get("disease") ?? "").trim();
    if (!diseaseSlug) {
      sendJson(res, 400, { ok: false, error: 'Missing query param "disease" (use a known diseaseSlug).' });
      return true;
    }
    try {
      const result = await suggestAyurvedaYogaForDisease(diseaseSlug);
      sendJson(res, 200, { ok: true, result });
    } catch (e: any) {
      sendJson(res, 400, { ok: false, error: e?.message ? String(e.message) : "Ayurveda suggestion failed." });
    }
    return true;
  }

  const answerIdMatch = url.pathname.match(/^\/api\/answers\/([^/]+)$/);
  if (req.method === "DELETE" && answerIdMatch) {
    const id = decodeURIComponent(answerIdMatch[1] ?? "");
    try {
      const removed = await deleteAnswerById(id);
      if (!removed) {
        sendJson(res, 404, { ok: false, error: "Answer not found." });
        return true;
      }
      sendJson(res, 200, { ok: true, deletedId: id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed.";
      sendJson(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  if (req.method === "DELETE" && url.pathname === "/api/answers") {
    try {
      const deletedCount = await deleteAllAnswers();
      sendJson(res, 200, { ok: true, deletedCount });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Clear history failed.";
      sendJson(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/answers") {
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "40", 10) || 40)
    );
    const rows = await prisma.answer.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        questionId: true,
        source: true,
        createdAt: true,
        payload: true
      }
    });
    sendJson(res, 200, { answers: rows });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/questions") {
    const rows = await prisma.question.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        slug: true,
        title: true,
        promptText: true,
        kind: true,
        createdAt: true
      }
    });
    sendJson(res, 200, { questions: rows });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/rag/ask-bank") {
    const body =
      (await readJsonBody<{ slug?: string; refresh?: boolean }>(req)) ?? {};
    try {
      const slug = body.slug?.trim();
      if (!slug) {
        sendJson(res, 400, { error: "Missing slug (e.g. qb_001)." });
        return true;
      }
      const result = await answerQuestionByBankSlug(slug, {
        refresh: body.refresh === true
      });
      sendJson(res, 200, result);
    } catch (e: any) {
      sendJson(res, 400, { error: e?.message ? String(e.message) : "RAG bank ask failed." });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/rag/ask") {
    const body =
      (await readJsonBody<{ question?: string; refresh?: boolean }>(req)) ?? {};
    try {
      const q = body.question?.trim();
      if (!q) {
        sendJson(res, 400, { error: "Missing question." });
        return true;
      }
      const result = await answerQuestionWithWebRag(q, { refresh: body.refresh === true });
      sendJson(res, 200, result);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "RAG failed.";
      sendJson(res, 400, { error: msg });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/manual/questions") {
    sendJson(res, 200, { questions: MANUAL_QUESTIONS });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/manual/q2") {
    const body = (await readJsonBody<{ diseaseSlug?: string }>(req)) ?? {};
    try {
      const slug = body.diseaseSlug?.trim();
      if (!slug) {
        sendJson(res, 400, { error: "Missing diseaseSlug." });
        return true;
      }
      const out = answerQ2HomeRemediesThenDoctors(slug);
      persistAnswerSafe({ source: AnswerSource.MANUAL_Q2, payload: out });
      sendJson(res, 200, out);
    } catch (e: any) {
      sendJson(res, 400, { error: e?.message ? String(e.message) : "Q2 failed." });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/manual/q3") {
    const body =
      (await readJsonBody<{ diseaseSlug?: string; stage?: number }>(req)) ?? {};
    try {
      const slug = body.diseaseSlug?.trim();
      const st = body.stage;
      if (!slug) {
        sendJson(res, 400, { error: "Missing diseaseSlug." });
        return true;
      }
      if (st !== 1 && st !== 2 && st !== 3) {
        sendJson(res, 400, { error: "stage must be 1, 2, or 3." });
        return true;
      }
      const out = answerQ3DoctorsForStage(slug, st as 1 | 2 | 3);
      persistAnswerSafe({ source: AnswerSource.MANUAL_Q3, payload: out });
      sendJson(res, 200, out);
    } catch (e: any) {
      sendJson(res, 400, { error: e?.message ? String(e.message) : "Q3 failed." });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/manual/q4") {
    const body =
      (await readJsonBody<{ pdfText?: string; pdfBase64?: string }>(req)) ?? {};
    try {
      const result = await answerQ4HealthReportDiseaseCureSolution(body);
      persistAnswerSafe({ source: AnswerSource.MANUAL_Q4, payload: result });
      sendJson(res, 200, result);
    } catch (e: any) {
      sendJson(res, 400, { error: e?.message ? String(e.message) : "Q4 failed." });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/report/analyze") {
    const body =
      (await readJsonBody<{
        pdfBase64?: string;
        pdfFilename?: string;
        pdfText?: string;
        fileBase64?: string;
        filename?: string;
        csvText?: string;
      }>(req)) ?? {};

    try {
      if (body.pdfText && body.pdfText.trim().length > 0) {
        const analysis = await analyzeReportTextAsync(body.pdfText);
        sendJson(res, 200, { ...analysis, input: { kind: "text", filename: body.pdfFilename } });
        return true;
      }

      const filename = body.filename ?? body.pdfFilename;
      const ext = (filename ?? "").toLowerCase();

      // Back-compat: pdfBase64 / pdfFilename
      if (body.pdfBase64) {
        const extracted = await extractTextFromPdfBase64(body.pdfBase64);
        const analysis = await analyzeReportTextAsync(extracted.text, extracted.pages);
        sendJson(res, 200, {
          ...analysis,
          input: { kind: "pdf", filename: body.pdfFilename, pages: extracted.pages }
        });
        return true;
      }

      // New: generic fileBase64 + filename
      if (body.fileBase64) {
        if (ext.endsWith(".pdf")) {
          const extracted = await extractTextFromPdfBase64(body.fileBase64);
          const analysis = await analyzeReportTextAsync(extracted.text, extracted.pages);
          sendJson(res, 200, {
            ...analysis,
            input: { kind: "pdf", filename, pages: extracted.pages }
          });
          return true;
        }
        if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
          const extracted = extractTextFromXlsxBase64(body.fileBase64);
          const analysis = await analyzeReportTextAsync(extracted.text);
          sendJson(res, 200, { ...analysis, input: { kind: "xlsx", filename } });
          return true;
        }
        sendJson(res, 400, { error: "Unsupported file type. Use PDF or XLSX." });
        return true;
      }

      // New: CSV can be passed as text (either directly or base64 if you prefer)
      if (body.csvText && body.csvText.trim().length > 0) {
        const extracted = extractTextFromCsvText(body.csvText);
        const analysis = await analyzeReportTextAsync(extracted.text);
        sendJson(res, 200, { ...analysis, input: { kind: "csv", filename } });
        return true;
      }

      sendJson(res, 400, { error: "Missing report input. Provide pdfBase64, pdfText, fileBase64+filename, or csvText." });
    } catch (e: any) {
      sendJson(res, 400, { error: e?.message ? String(e.message) : "Report analysis failed." });
    }
    return true;
  }

  const carePlanMatch = url.pathname.match(/^\/api\/diseases\/([^/]+)\/care-plan$/);
  if (req.method === "GET" && carePlanMatch) {
    const slug = carePlanMatch[1]!;
    try {
      const plan = buildCarePlan(slug);
      sendJson(res, 200, plan);
    } catch (e: any) {
      sendJson(res, 404, { error: e?.message ? String(e.message) : "Care plan not available." });
    }
    return true;
  }

  const predictMatch = url.pathname.match(/^\/api\/diseases\/([^/]+)\/predict$/);
  if (req.method === "POST" && predictMatch) {
    const slug = predictMatch[1];
    if (!slug) {
      sendJson(res, 400, { error: "Missing disease slug." });
      return true;
    }
    const body =
      (await readJsonBody<{
        imageBase64?: string;
        imageMimeType?: string;
        imageByteLength?: number;
        imageHash?: string;
        form?: Record<string, string | number | boolean>;
      }>(req)) ?? {};

    try {
      const result = await runDiseasePipeline(slug, body);
      const detection = (result as { detection?: { classification: string; riskLevel: "low" | "medium" | "high" } })
        .detection;
      let carePlan = null;
      if (
        detection &&
        shouldAttachCarePlan(detection.classification, detection.riskLevel)
      ) {
        try {
          carePlan = buildCarePlan(slug);
        } catch {
          carePlan = null;
        }
      }
      sendJson(res, 200, { ...result, carePlan });
    } catch (e: any) {
      sendJson(res, 400, { error: e?.message ? String(e.message) : "Prediction failed." });
    }
    return true;
  }

  const healerHandled = await handleHealerApiRequest(req, res);
  if (healerHandled) return true;

  sendJson(res, 404, { error: "Not Found" });
  return true;
}
