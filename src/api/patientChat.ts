import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { answerQuestionWithWebRag } from "../rag/dynamicWebRag.js";
import type { DynamicWebRagResult } from "../rag/dynamicWebRag.js";
import { buildSimplePatientPlain } from "./simplePatientExplain.js";

const MAX_DOC_CHARS = 10_000;

export type PatientChatRequest = {
  message?: string;
  language?: string;
  pdfBase64?: string;
  pdfFilename?: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** When true, include full RAG JSON in the response (larger payload). */
  includeRawRag?: boolean;
};

export type PatientChatResponse = {
  ok: boolean;
  patientText?: string;
  requestedLanguage?: string;
  sourcesUsed?: string[];
  disclaimer?: string;
  languageNote?: string;
  rawRag?: DynamicWebRagResult;
  error?: string;
};

const DISCLAIMER =
  "Education-only demo. Not medical advice. English plain-language summary only; no image reading.";

export async function executePatientChat(
  raw: unknown
): Promise<PatientChatResponse> {
  const body = (raw && typeof raw === "object" ? raw : {}) as PatientChatRequest;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "English";

  if (message.length < 3) {
    return {
      ok: false,
      error: "message must be at least 3 characters."
    };
  }

  const sourcesUsed: string[] = [];
  let docExcerpt = "";

  if (typeof body.pdfBase64 === "string" && body.pdfBase64.trim()) {
    try {
      const { text } = await extractTextFromPdfBase64(body.pdfBase64.trim(), {
        maxChars: MAX_DOC_CHARS
      });
      docExcerpt = text.trim();
      if (docExcerpt.length > 0) sourcesUsed.push("pdf_excerpt");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF read failed.";
      return { ok: false, error: msg };
    }
  }

  const hasImage =
    typeof body.imageBase64 === "string" &&
    body.imageBase64.trim().length > 8;
  if (hasImage) sourcesUsed.push("image_attachment_meta");

  const composed =
    docExcerpt.length > 0
      ? `${message}\n\n---\nContext from uploaded document:\n${docExcerpt.slice(0, MAX_DOC_CHARS)}`
      : message;

  let rag: DynamicWebRagResult;
  try {
    rag = await answerQuestionWithWebRag(composed, {
      refresh: false,
      skipGeminiSynthesis: true
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "RAG failed.";
    return { ok: false, error: msg };
  }

  sourcesUsed.push("web_rag");

  const patientText = buildSimplePatientPlain({
    rag,
    requestedLanguage: language,
    hasPdfExcerpt: docExcerpt.length > 0,
    hasImageAttachment: !!hasImage
  });

  const out: PatientChatResponse = {
    ok: true,
    patientText,
    requestedLanguage: language,
    sourcesUsed,
    disclaimer: DISCLAIMER,
    languageNote:
      "Plain English only. For other languages, use a human translator or a future LLM-enabled build."
  };

  if (body.includeRawRag === true) {
    out.rawRag = rag;
  }

  return out;
}
