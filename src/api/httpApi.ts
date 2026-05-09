import type { IncomingMessage, ServerResponse } from "node:http";
import { listDiseases, runDiseasePipeline } from "../diseases/registry.js";
import { buildCarePlan, shouldAttachCarePlan } from "../care/carePlan.js";
import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { analyzeReportText } from "../report/analyzeReport.js";
import { extractTextFromCsvText, extractTextFromXlsxBase64 } from "../report/tabularText.js";

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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
        const analysis = analyzeReportText(body.pdfText);
        sendJson(res, 200, { ...analysis, input: { kind: "text", filename: body.pdfFilename } });
        return true;
      }

      const filename = body.filename ?? body.pdfFilename;
      const ext = (filename ?? "").toLowerCase();

      // Back-compat: pdfBase64 / pdfFilename
      if (body.pdfBase64) {
        const extracted = await extractTextFromPdfBase64(body.pdfBase64);
        const analysis = analyzeReportText(extracted.text, extracted.pages);
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
          const analysis = analyzeReportText(extracted.text, extracted.pages);
          sendJson(res, 200, {
            ...analysis,
            input: { kind: "pdf", filename, pages: extracted.pages }
          });
          return true;
        }
        if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
          const extracted = extractTextFromXlsxBase64(body.fileBase64);
          const analysis = analyzeReportText(extracted.text);
          sendJson(res, 200, { ...analysis, input: { kind: "xlsx", filename } });
          return true;
        }
        sendJson(res, 400, { error: "Unsupported file type. Use PDF or XLSX." });
        return true;
      }

      // New: CSV can be passed as text (either directly or base64 if you prefer)
      if (body.csvText && body.csvText.trim().length > 0) {
        const extracted = extractTextFromCsvText(body.csvText);
        const analysis = analyzeReportText(extracted.text);
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

  sendJson(res, 404, { error: "Not Found" });
  return true;
}
