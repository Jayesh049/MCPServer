/**
 * Google Gemini Developer API (AI Studio key). Used for embeddings and optional RAG synthesis.
 * Docs: https://ai.google.dev/api/rest
 */

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/";
const MAX_INPUT_CHARS = 8_000;

function apiKey(): string | undefined {
  const k =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  return k || undefined;
}

/** Public check for routing in embed.ts */
export function hasGeminiApiKey(): boolean {
  return !!apiKey();
}

type GeminiEmbedTask =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY";

function embedEndpoint(modelId: string): string {
  const m = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  return `${GEMINI_EMBED_URL}${m}:embedContent`;
}

function generateEndpoint(modelId: string): string {
  const m = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  return `${GEMINI_EMBED_URL}${m}:generateContent`;
}

/** Single-text embedding for RAG (task type matches indexing vs query when possible). */
export async function geminiEmbedText(
  text: string,
  purpose: "corpus" | "query"
): Promise<number[]> {
  const key = apiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is required for Gemini embeddings.");
  }
  const model =
    process.env.GEMINI_EMBED_MODEL?.trim() || "text-embedding-004";
  const input = text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
  const taskType: GeminiEmbedTask =
    purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";

  const url = embedEndpoint(model);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      model: `models/${model.replace(/^models\//, "")}`,
      content: { parts: [{ text: input }] },
      taskType
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini embedContent failed (${res.status}): ${err.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    embedding?: { values?: number[] };
  };
  const vec = data.embedding?.values;
  if (!vec?.length) {
    throw new Error("Gemini embedContent response missing embedding.values.");
  }
  return vec;
}

/**
 * Short grounded answer from retrieved passages (education demo; not medical advice).
 */
export async function geminiSynthesizeRagAnswer(
  question: string,
  passages: string[]
): Promise<string> {
  const key = apiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is required for synthesis.");
  }
  const model =
    process.env.GEMINI_GENERATE_MODEL?.trim() || "gemini-1.5-flash";
  const ctx = passages
    .map((p, i) => `[${i + 1}] ${p.slice(0, 4_000)}`)
    .join("\n\n")
    .slice(0, 24_000);

  const prompt =
    `You are a careful assistant. Answer using ONLY the context passages below. ` +
    `If the context is insufficient, say so briefly. This is general education, not individual medical advice.\n\n` +
    `Question: ${question}\n\nContext:\n${ctx}`;

  const url = generateEndpoint(model);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024
      }
    })
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini generateContent failed (${res.status}): ${err.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts;
  const text = parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Gemini returned an empty answer.");
  }
  return text.trim();
}

export function isRagGeminiSynthesisEnabled(): boolean {
  return (
    (process.env.RAG_GEMINI_SYNTHESIS ?? "").toLowerCase() === "1" ||
    (process.env.RAG_GEMINI_SYNTHESIS ?? "").toLowerCase() === "true"
  );
}
