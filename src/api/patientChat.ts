/**
 * Patient chat: Wikipedia RAG (grounding) + optional LLM to write simple, multilingual answers.
 *
 * - RAG always runs first (`answerQuestionWithWebRag`, `skipGeminiSynthesis: true`).
 * - LLM provider (first available key): **Gemini → Groq → OpenAI → Anthropic → OpenRouter** → template fallback.
 * - Recommended for dev: **GEMINI_API_KEY** (same as embeddings; AI Studio free tier).
 * - Set **PATIENT_CHAT_DISABLE_LLM=1** to force template-only (no external LLM).
 * - Optional **history**: `{ role, content }[]` for multi-turn (passed to the LLM only).
 */

import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { answerQuestionWithWebRag } from "../rag/dynamicWebRag.js";
import type { DynamicWebRagResult } from "../rag/dynamicWebRag.js";

const MAX_DOC_CHARS = 10_000;
const MAX_RAG_CONTEXT_CHARS = 3_000;

const DISCLAIMER =
  "Education-only demo. AI-generated responses are not medical advice. Always consult a qualified clinician.";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type PatientChatRequest = {
  message?: string;
  language?: string;
  pdfBase64?: string;
  pdfFilename?: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** Pass previous turns to enable multi-turn conversation */
  history?: ChatTurn[];
  /** When true, include full RAG JSON in the response (larger payload). */
  includeRawRag?: boolean;
};

export type PatientChatResponse = {
  ok: boolean;
  patientText?: string;
  requestedLanguage?: string;
  sourcesUsed?: string[];
  llmProvider?: string;
  /** When LLM is off, explains template-only mode. */
  languageNote?: string;
  disclaimer?: string;
  rawRag?: DynamicWebRagResult;
  error?: string;
};

// ---------------------------------------------------------------------------
// LLM provider implementations
// ---------------------------------------------------------------------------

/**
 * Detect which LLM to use for patient chat (first match wins).
 * Order: Gemini → Groq → OpenAI → Anthropic → OpenRouter → none.
 * Rationale: Gemini matches existing GOOGLE_API_KEY / AI Studio setup, strong multilingual, free tier;
 * Groq is very fast/cheap; OpenAI widely known; Anthropic/OpenRouter optional.
 */
function detectProvider():
  | "anthropic"
  | "gemini"
  | "groq"
  | "openai"
  | "openrouter"
  | "none" {
  if (
    (process.env.PATIENT_CHAT_DISABLE_LLM ?? "").toLowerCase() === "1" ||
    (process.env.PATIENT_CHAT_DISABLE_LLM ?? "").toLowerCase() === "true"
  ) {
    return "none";
  }
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) return "gemini";
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  return "none";
}

function buildSystemPrompt(ragContext: string, language: string, hasPdf: boolean): string {
  const langNote = language.toLowerCase() === "english"
    ? "Reply in clear, simple English."
    : `Reply in ${language}. If you are not confident in that language, reply in English and add a note.`;

  const docNote = hasPdf
    ? "The user has also uploaded a document — relevant excerpts are included in the context."
    : "";

  return [
    "You are a patient-education assistant helping everyday people understand health topics.",
    langNote,
    "Use the medical context provided below to ground your answer.",
    "Write in short, simple sentences. Avoid jargon. If you must use a medical term, explain it immediately.",
    "Never give a personal diagnosis or prescribe treatment.",
    "Always end your response with exactly one sentence starting with: 'Please speak with a doctor or healthcare professional'.",
    docNote,
    "",
    "--- Medical context (from Wikipedia / uploaded document) ---",
    ragContext.slice(0, MAX_RAG_CONTEXT_CHARS),
    "--- End of context ---",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Anthropic Claude — claude-haiku-4-5 is the cheapest/fastest option */
async function callAnthropic(
  system: string,
  history: ChatTurn[],
  message: string
): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system,
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic error (${res.status}): ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim() ?? "";
}

/**
 * Google Gemini 1.5 Flash — FREE tier: 15 req/min, 1 million tokens/day
 * Get key: https://aistudio.google.com/apikey
 */
async function callGemini(
  system: string,
  history: ChatTurn[],
  message: string
): Promise<string> {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)!.trim();
  const model = process.env.GEMINI_GENERATE_MODEL?.trim() || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Gemini uses a systemInstruction field + contents array
  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini error (${res.status}): ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text.trim();
}

/**
 * Groq — FREE tier, very fast (Llama 3.1 70B or Mixtral)
 * Get key: https://console.groq.com/keys
 */
async function callGroq(
  system: string,
  history: ChatTurn[],
  message: string
): Promise<string> {
  const model = process.env.GROQ_MODEL?.trim() || "llama-3.1-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Groq error (${res.status}): ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** OpenAI GPT-4o-mini */
async function callOpenAI(
  system: string,
  history: ChatTurn[],
  message: string
): Promise<string> {
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI error (${res.status}): ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * OpenRouter — access many free models via one API
 * Free models: https://openrouter.ai/models?q=free
 * Get key: https://openrouter.ai/settings/keys
 */
async function callOpenRouter(
  system: string,
  history: ChatTurn[],
  message: string
): Promise<string> {
  // Default: meta-llama/llama-3.1-8b-instruct:free (truly free, no credit needed)
  const model = process.env.OPENROUTER_MODEL?.trim() || "meta-llama/llama-3.1-8b-instruct:free";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter error (${res.status}): ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Fallback when no API key is configured — better than the original template */
function fallbackResponse(
  message: string,
  ragContext: string,
  options?: { llmConfigured?: boolean }
): string {
  const preview = ragContext.slice(0, 600).trim();
  const lines = [
    `Here is what general medical sources say about your question:`,
    ``,
    preview ||
      "No relevant information was found for your question. Try a clearer health question (e.g. “What is diabetes?”), or check “Include raw RAG JSON” and confirm indexedChunks > 0.",
    ``,
    `This is a general education summary — not personalised advice.`,
    `Please speak with a doctor or healthcare professional for guidance specific to your situation.`
  ];
  if (!options?.llmConfigured) {
    lines.push(
      ``,
      `(To enable AI-powered responses, add GEMINI_API_KEY or GROQ_API_KEY to your .env file — both have a free tier.)`
    );
  }
  return lines.join("\n");
}

/** Route to the right provider and call it */
async function synthesizeAnswer(
  system: string,
  history: ChatTurn[],
  message: string,
  provider: ReturnType<typeof detectProvider>
): Promise<string> {
  switch (provider) {
    case "anthropic":  return callAnthropic(system, history, message);
    case "gemini":     return callGemini(system, history, message);
    case "groq":       return callGroq(system, history, message);
    case "openai":     return callOpenAI(system, history, message);
    case "openrouter": return callOpenRouter(system, history, message);
    default:           return "";
  }
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function executePatientChat(
  raw: unknown
): Promise<PatientChatResponse> {
  const body = (raw && typeof raw === "object" ? raw : {}) as PatientChatRequest;

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : "English";
  const history: ChatTurn[] = Array.isArray(body.history) ? body.history : [];

  if (message.length < 3) {
    return { ok: false, error: "message must be at least 3 characters." };
  }

  const sourcesUsed: string[] = [];
  let docExcerpt = "";

  // --- PDF extraction (unchanged from original) ---
  if (typeof body.pdfBase64 === "string" && body.pdfBase64.trim()) {
    try {
      const { text } = await extractTextFromPdfBase64(body.pdfBase64.trim(), {
        maxChars: MAX_DOC_CHARS,
      });
      docExcerpt = text.trim();
      if (docExcerpt.length > 0) sourcesUsed.push("pdf_excerpt");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF read failed.";
      return { ok: false, error: msg };
    }
  }

  const hasImage =
    typeof body.imageBase64 === "string" && body.imageBase64.trim().length > 8;
  if (hasImage) sourcesUsed.push("image_attachment_meta");

  // Compose the RAG query (message + doc context if present)
  const ragQuery =
    docExcerpt.length > 0
      ? `${message}\n\n---\nContext from uploaded document:\n${docExcerpt.slice(0, MAX_DOC_CHARS)}`
      : message;

  // --- RAG retrieval ---
  let rag: DynamicWebRagResult;
  try {
    rag = await answerQuestionWithWebRag(ragQuery, {
      refresh: false,
      skipGeminiSynthesis: true, // We do our own synthesis below
    });
    sourcesUsed.push("web_rag");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "RAG failed.";
    return { ok: false, error: msg };
  }

  // Build RAG context string for the LLM
  const ragContext = [
    ...rag.topMatches.slice(0, 4).map((m) => m.content),
    ...(docExcerpt ? [`--- From your uploaded document ---\n${docExcerpt.slice(0, 2000)}`] : []),
  ].join("\n\n");

  // --- LLM synthesis ---
  const provider = detectProvider();
  const system = buildSystemPrompt(ragContext, language, docExcerpt.length > 0);

  const llmConfigured = provider !== "none";
  let patientText: string;
  try {
    if (provider === "none") {
      patientText = fallbackResponse(message, ragContext, { llmConfigured: false });
    } else {
      patientText = await synthesizeAnswer(system, history, message, provider);
      sourcesUsed.push(`llm_${provider}`);
    }
  } catch (e) {
    // LLM call failed — fall back gracefully rather than returning an error
    console.error("[patientChat] LLM synthesis failed, using fallback:", e);
    patientText = fallbackResponse(message, ragContext, { llmConfigured });
  }

  if (!patientText) {
    patientText = fallbackResponse(message, ragContext, { llmConfigured });
  }

  const out: PatientChatResponse = {
    ok: true,
    patientText,
    requestedLanguage: language,
    sourcesUsed,
    llmProvider: provider,
    disclaimer: DISCLAIMER,
    languageNote:
      provider === "none"
        ? "No LLM API key set (or PATIENT_CHAT_DISABLE_LLM=1). Reply is a short template from retrieved text. Add GEMINI_API_KEY in .env for simple, multilingual answers."
        : `Answer drafted by ${provider} using only the retrieved context above.`
  };

  if (body.includeRawRag === true) {
    out.rawRag = rag;
  }

  return out;
}
