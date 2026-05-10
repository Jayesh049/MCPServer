import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { geminiEmbedText, hasGeminiApiKey } from "./gemini.js";

const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_OPENAI_MODEL = "text-embedding-3-small";
const LOCAL_MODEL =
  process.env.RAG_LOCAL_EMBED_MODEL?.trim() || "Xenova/all-MiniLM-L6-v2";
const MAX_INPUT_CHARS = 12_000;

export type EmbedProvider = "openai" | "local" | "gemini";

export type EmbedTextOptions = {
  /** For Gemini only: corpus chunks vs user query (different task types). Ignored for OpenAI/local. */
  purpose?: "corpus" | "query";
};

function resolveProvider(): EmbedProvider {
  const mode = (process.env.RAG_EMBEDDING_PROVIDER ?? "auto").toLowerCase();
  if (mode === "gemini") return "gemini";
  if (mode === "openai") return "openai";
  if (mode === "local") return "local";
  if (mode === "auto") {
    if (hasGeminiApiKey()) return "gemini";
    if (process.env.OPENAI_API_KEY?.trim()) return "openai";
    return "local";
  }
  throw new Error(
    `Invalid RAG_EMBEDDING_PROVIDER "${process.env.RAG_EMBEDDING_PROVIDER}". Use auto, gemini, openai, or local.`
  );
}

let localExtractor: FeatureExtractionPipeline | null = null;

async function getLocalExtractor(): Promise<FeatureExtractionPipeline> {
  if (!localExtractor) {
    localExtractor = await pipeline("feature-extraction", LOCAL_MODEL);
  }
  return localExtractor;
}

async function embedOpenAI(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is required when RAG_EMBEDDING_PROVIDER=openai.");
  }
  const model = process.env.RAG_EMBEDDING_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const input =
    text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

  const res = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({ model, input })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `OpenAI embeddings failed (${res.status}): ${errText.slice(0, 500)}`
    );
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  const vec = data.data?.[0]?.embedding;
  if (!vec?.length) throw new Error("OpenAI embeddings response missing vector.");
  return vec;
}

async function embedLocal(text: string): Promise<number[]> {
  const input =
    text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;
  const extractor = await getLocalExtractor();
  const out = await extractor(input, { pooling: "mean", normalize: true });
  const data = out?.data;
  if (!data) throw new Error("Local embedding produced no tensor data.");
  return Array.from(data as Float32Array | number[]);
}

/**
 * Embeds text.
 * - **auto:** Gemini key → Gemini; else OpenAI key → OpenAI; else local Transformers.js.
 * - Use `purpose: "corpus"` when indexing chunks, `purpose: "query"` for the user question (Gemini only).
 */
export async function embedText(
  text: string,
  options?: EmbedTextOptions
): Promise<number[]> {
  const provider = resolveProvider();
  const purpose = options?.purpose ?? "corpus";
  if (provider === "openai") return embedOpenAI(text);
  if (provider === "gemini") return geminiEmbedText(text, purpose);
  return embedLocal(text);
}

export function getActiveEmbedProvider(): EmbedProvider {
  return resolveProvider();
}
