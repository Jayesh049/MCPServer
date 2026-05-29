import type { Prisma } from "@prisma/client";
import { QuestionKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { embedText } from "../rag/embed.js";
import { chunkText } from "../rag/textChunks.js";
import type { AyurvedaSource } from "./sources.js";

function ayurvedaQuestionSlug(sourceId: string): string {
  return `ayu_src_${sourceId}`.replace(/[^a-zA-Z0-9_]+/g, "_");
}

function stripHtmlToText(html: string): string {
  // Very small / dependency-free HTML->text. Good enough for sacred-texts pages.
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withBreaks = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n");
  const text = withBreaks.replace(/<[^>]+>/g, " ");
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchText(url: string): Promise<{ text: string; contentType?: string }> {
  const timeoutMs = Math.min(
    Math.max(Number(process.env.AYURVEDA_FETCH_TIMEOUT_MS ?? "20000"), 3000),
    120_000
  );
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, {
    signal: controller.signal,
    headers: {
      // Some sources block empty UA; keep it simple.
      "User-Agent": "agents-assemble-sharp-mcp/0.1 (ayurveda-ingest)",
      Accept: "text/plain,text/html,application/xhtml+xml"
    }
  }).finally(() => clearTimeout(t));
  const contentType = res.headers.get("content-type") ?? undefined;
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}: ${raw.slice(0, 200)}`);
  }
  const isHtml =
    (contentType?.includes("text/html") ?? false) || /^\s*<!doctype html/i.test(raw);
  return { text: isHtml ? stripHtmlToText(raw) : raw.trim(), contentType };
}

async function ensureQuestionForSource(source: AyurvedaSource): Promise<{ id: string; slug: string }> {
  const slug = ayurvedaQuestionSlug(source.id);
  const existing = await prisma.question.findUnique({ where: { slug }, select: { id: true, slug: true } });
  if (existing) return existing;
  const created = await prisma.question.create({
    data: {
      slug,
      title: source.title,
      promptText: `Ayurveda/Yoga corpus source: ${source.title}`,
      kind: QuestionKind.BANK
    },
    select: { id: true, slug: true }
  });
  return created;
}

export type AyurvedaIngestResult = {
  sourceId: string;
  questionSlug: string;
  urlsFetched: number;
  chunksAdded: number;
  failures: Array<{ url: string; error: string }>;
};

export async function rebuildAyurvedaCorpusForSource(source: AyurvedaSource): Promise<AyurvedaIngestResult> {
  const q = await ensureQuestionForSource(source);
  await prisma.ragChunk.deleteMany({ where: { questionId: q.id } });

  let urlsFetched = 0;
  let chunksAdded = 0;
  let chunkIndex = 0;
  const failures: AyurvedaIngestResult["failures"] = [];
  const maxChunks = Math.min(
    Math.max(Number(process.env.AYURVEDA_MAX_CHUNKS_PER_SOURCE ?? "800"), 50),
    20_000
  );

  for (const url of source.urls) {
    try {
      const { text } = await fetchText(url);
      urlsFetched++;
      if (!text.trim()) continue;

      const pieces = chunkText(text, 1400);
      for (const piece of pieces) {
        if (chunksAdded >= maxChunks) break;
        const content = `[${source.title}]\n${piece}`;
        const vec = await embedText(content, { purpose: "corpus" });
        const meta: Prisma.InputJsonValue = {
          kind: "ayurveda-source-chunk",
          sourceId: source.id,
          sourceTitle: source.title,
          sourceUrl: url,
          license: source.license,
          chunkIndex: chunkIndex++
        };
        await prisma.ragChunk.create({
          data: {
            questionId: q.id,
            content,
            meta,
            embedding: vec as unknown as Prisma.InputJsonValue
          }
        });
        chunksAdded++;
      }
    } catch (e: any) {
      failures.push({ url, error: e?.message ? String(e.message) : "Unknown error" });
    }
  }

  return {
    sourceId: source.id,
    questionSlug: q.slug,
    urlsFetched,
    chunksAdded,
    failures
  };
}

