/**
 * Patient chat: **trained corpus RAG** (default) or live Wikipedia RAG + LLM synthesis.
 *
 * - Default (`PATIENT_CHAT_RAG_SOURCE=trained`): retrieve pre-indexed chunks from Postgres
 *   (`npm run db:train-bank`) — **no Wikipedia at query time**. Groq/Gemini write the answer.
 * - Legacy (`PATIENT_CHAT_RAG_SOURCE=wikipedia`): live Wikipedia fetch per question.
 * - LLM order: **Groq → Gemini** → OpenAI → Anthropic → OpenRouter.
 * - Set **PATIENT_CHAT_DISABLE_LLM=1** for template-only replies.
 */

import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { answerQuestionWithWebRag } from "../rag/dynamicWebRag.js";
import type { DynamicWebRagResult } from "../rag/dynamicWebRag.js";
import { answerQuestionWithTrainedCorpus } from "../rag/trainedCorpusRag.js";
import type { TrainedCorpusRagResult } from "../rag/trainedCorpusRag.js";

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
  rawRag?: DynamicWebRagResult | TrainedCorpusRagResult;
  ragSource?: "trained_corpus" | "wikipedia";
  error?: string;
};

function patientChatRagSource(): "trained" | "wikipedia" {
  const v = (process.env.PATIENT_CHAT_RAG_SOURCE ?? "trained").toLowerCase();
  return v === "wikipedia" || v === "web" ? "wikipedia" : "trained";
}

// ---------------------------------------------------------------------------
// LLM provider implementations
// ---------------------------------------------------------------------------

export type PatientChatLlmProvider =
  | "anthropic"
  | "gemini"
  | "groq"
  | "openai"
  | "openrouter";

function isLlmDisabled(): boolean {
  const v = (process.env.PATIENT_CHAT_DISABLE_LLM ?? "").toLowerCase();
  return v === "1" || v === "true";
}

/**
 * Patient chat LLM priority: Groq first, then Gemini, then other keys.
 */
function patientChatProviderChain(): PatientChatLlmProvider[] {
  if (isLlmDisabled()) return [];
  const chain: PatientChatLlmProvider[] = [];
  if (process.env.GROQ_API_KEY?.trim()) chain.push("groq");
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    chain.push("gemini");
  }
  if (process.env.OPENAI_API_KEY?.trim()) chain.push("openai");
  if (process.env.ANTHROPIC_API_KEY?.trim()) chain.push("anthropic");
  if (process.env.OPENROUTER_API_KEY?.trim()) chain.push("openrouter");
  return chain;
}

/** First provider in chain (for badges / metadata). */
function detectProvider(): PatientChatLlmProvider | "none" {
  const chain = patientChatProviderChain();
  return chain[0] ?? "none";
}

/** Strip chat filler so Wikipedia search matches the topic (e.g. drinking water). */
function wikipediaSearchQueryFromMessage(message: string): string {
  let q = message.trim();
  const stripOnce = (re: RegExp) => {
    q = q.replace(re, "").trim();
  };
  stripOnce(/^(hey|hi|hello|please|thanks)[,!.\s]+/i);
  for (let i = 0; i < 6; i++) {
    const before = q;
    stripOnce(
      /^(can you|could you|would you|tell me|explain|describe|what is|what are|what's|whats|significance of|meaning of|importance of|about|regarding)\s+/i
    );
    if (q === before) break;
  }
  q = q.replace(/[?.!]+$/g, "").trim();
  return q.length >= 3 ? q : message.trim();
}

function buildSystemPrompt(
  ragContext: string,
  language: string,
  hasPdf: boolean,
  ragSource: "trained" | "wikipedia"
): string {
  const langNote = language.toLowerCase() === "english"
    ? "Reply in clear, simple English."
    : `Reply in ${language}. If you are not confident in that language, reply in English and add a note.`;

  const docNote = hasPdf
    ? "The user has also uploaded a document — relevant excerpts are included in the context."
    : "";

  return [
    "You are a patient-education assistant helping everyday people understand health topics.",
    langNote,
    ragSource === "trained"
      ? "The context below was retrieved from our pre-trained medical education corpus (indexed Q&A bank in the database — not live web search)."
      : "The context below was retrieved from Wikipedia (and any uploaded document).",
    "Answer ONLY about the user's topic using that context. Do not introduce unrelated articles or topics.",
    "If the context does not clearly cover the question, say so briefly and suggest a clearer health-related question.",
    "Write in short, simple sentences. Avoid jargon. If you must use a medical term, explain it immediately.",
    "Never give a personal diagnosis or prescribe treatment.",
    "Always end your response with exactly one sentence starting with: 'Please speak with a doctor or healthcare professional'.",
    docNote,
    "",
    "--- Retrieved context (ground truth for this answer) ---",
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
      `(To enable AI-powered responses, add GROQ_API_KEY first, or GEMINI_API_KEY as fallback — both have a free tier.)`
    );
  }
  return lines.join("\n");
}

async function synthesizeAnswer(
  system: string,
  history: ChatTurn[],
  message: string,
  provider: PatientChatLlmProvider
): Promise<string> {
  switch (provider) {
    case "anthropic":
      return callAnthropic(system, history, message);
    case "gemini":
      return callGemini(system, history, message);
    case "groq":
      return callGroq(system, history, message);
    case "openai":
      return callOpenAI(system, history, message);
    case "openrouter":
      return callOpenRouter(system, history, message);
  }
}

/** Groq first, then Gemini, then other configured providers. */
async function synthesizeWithFallback(
  system: string,
  history: ChatTurn[],
  message: string
): Promise<{ text: string; provider: PatientChatLlmProvider | "none" }> {
  const chain = patientChatProviderChain();
  for (const provider of chain) {
    try {
      const text = await synthesizeAnswer(system, history, message, provider);
      if (text.trim()) return { text: text.trim(), provider };
    } catch (e) {
      console.warn(`[patientChat] ${provider} failed, trying next provider:`, e);
    }
  }
  return { text: "", provider: "none" };
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

  const searchQuery = wikipediaSearchQueryFromMessage(message);
  const ragMode = patientChatRagSource();

  const ragQuery =
    docExcerpt.length > 0
      ? `${searchQuery}\n\n---\nContext from uploaded document:\n${docExcerpt.slice(0, MAX_DOC_CHARS)}`
      : searchQuery;

  let rag: DynamicWebRagResult | TrainedCorpusRagResult;
  try {
    if (ragMode === "wikipedia") {
      rag = await answerQuestionWithWebRag(ragQuery, {
        refresh: true,
        skipGeminiSynthesis: true,
      });
      sourcesUsed.push("web_rag");
    } else {
      rag = await answerQuestionWithTrainedCorpus(ragQuery);
      sourcesUsed.push("trained_rag");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "RAG failed.";
    return { ok: false, error: msg };
  }

  // Build RAG context string for the LLM
  const ragContext = [
    ...rag.topMatches.slice(0, 4).map((m) => m.content),
    ...(docExcerpt ? [`--- From your uploaded document ---\n${docExcerpt.slice(0, 2000)}`] : []),
  ].join("\n\n");

  // --- LLM synthesis (Groq → Gemini → …) ---
  const system = buildSystemPrompt(
    ragContext,
    language,
    docExcerpt.length > 0,
    ragMode
  );
  const chain = patientChatProviderChain();
  const llmConfigured = chain.length > 0;

  let patientText = "";
  let usedProvider: PatientChatLlmProvider | "none" = "none";

  if (!llmConfigured) {
    patientText = fallbackResponse(message, ragContext, { llmConfigured: false });
  } else {
    const synth = await synthesizeWithFallback(system, history, message);
    usedProvider = synth.provider;
    patientText = synth.text;
    if (usedProvider !== "none") {
      sourcesUsed.push(`llm_${usedProvider}`);
    }
  }

  if (!patientText.trim()) {
    patientText = fallbackResponse(message, ragContext, { llmConfigured });
  }

  const out: PatientChatResponse = {
    ok: true,
    patientText,
    requestedLanguage: language,
    sourcesUsed,
    llmProvider: usedProvider === "none" ? detectProvider() : usedProvider,
    disclaimer: DISCLAIMER,
    ragSource: rag.webSource === "trained_corpus" ? "trained_corpus" : "wikipedia",
    languageNote:
      usedProvider === "none"
        ? ragMode === "trained"
          ? "No LLM API key set. Reply uses trained corpus excerpts only. Add GROQ_API_KEY or GEMINI_API_KEY."
          : "No LLM API key set. Reply is from Wikipedia excerpts only. Add GROQ_API_KEY or GEMINI_API_KEY."
        : ragMode === "trained"
          ? `Answer drafted by ${usedProvider} using trained RAG (Groq/Gemini + indexed corpus). Topic: "${searchQuery.slice(0, 80)}".`
          : `Answer drafted by ${usedProvider} using Wikipedia context for: "${searchQuery.slice(0, 80)}".`
  };

  if (body.includeRawRag === true) {
    out.rawRag = rag;
  }

  return out;
}
