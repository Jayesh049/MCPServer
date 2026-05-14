import fs from "node:fs/promises";
import path from "node:path";

import type { HealerFixPayload } from "./types.js";
import { isHealerFixPayload } from "./types.js";
import { hasGeminiApiKey } from "../rag/gemini.js";
import type { ParsedHealerError } from "./types.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || undefined;
}

function geminiModel(): string {
  return process.env.HEALER_GEMINI_MODEL?.trim() || process.env.GEMINI_GENERATE_MODEL?.trim() || "gemini-1.5-flash";
}

function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

function openaiModel(): string {
  return process.env.HEALER_OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

async function readSnippet(repoRoot: string, relPath: string | null, line: number | null): Promise<string> {
  if (!relPath) return "";
  const abs = path.resolve(repoRoot, relPath.replace(/\\/g, "/"));
  try {
    const text = await fs.readFile(abs, "utf8");
    const lines = text.split("\n");
    if (line !== null && line >= 1 && line <= lines.length) {
      const lo = Math.max(0, line - 8);
      const hi = Math.min(lines.length, line + 8);
      return lines.slice(lo, hi).map((l, i) => `${lo + i + 1}: ${l}`).join("\n");
    }
    return lines.slice(0, 40).map((l, i) => `${i + 1}: ${l}`).join("\n");
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `You fix dev-time compile/runtime errors. Reply with ONLY valid JSON (no markdown fences) matching this shape:
{"edits":[{"path":"relative/path/from/repo/root","search":"exact substring to replace once","replace":"new substring"}]}
Rules:
- path must use forward slashes, relative to repo root, under src/, frontend/, or ml/ only.
- search must match exactly once in that file.
- Minimal change: fix the reported error only.
- If you cannot fix safely, return {"edits":[]}.`;

async function geminiJson(userPrompt: string): Promise<string> {
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) required for healer LLM.");
  const model = geminiModel();
  const m = model.includes("/") ? model.split("/").pop()! : model;
  const url = `${GEMINI_URL}${m}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
    })
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini healer failed (${res.status}): ${err.slice(0, 800)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts;
  return parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function openaiJson(userPrompt: string): Promise<string> {
  const key = openaiKey();
  if (!key) throw new Error("OPENAI_API_KEY required for healer LLM when Gemini is unavailable.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: openaiModel(),
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI healer failed (${res.status}): ${err.slice(0, 800)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function parsePayload(jsonStr: string): HealerFixPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("LLM returned non-JSON.");
  }
  if (!isHealerFixPayload(parsed)) {
    throw new Error("LLM JSON does not match { edits: [{ path, search, replace }] }.");
  }
  if (parsed.edits.length === 0) {
    throw new Error("LLM returned empty edits.");
  }
  return parsed;
}

export async function requestLlmFix(repoRoot: string, parsed: ParsedHealerError): Promise<HealerFixPayload> {
  const snippet = await readSnippet(repoRoot, parsed.primaryFilePath, parsed.primaryLine);
  const userPrompt =
    `Repo root: ${repoRoot}\n` +
    `Stack: ${parsed.techStack}\n` +
    `Primary file: ${parsed.primaryFilePath ?? "(unknown)"}\n` +
    `Line: ${parsed.primaryLine ?? "(unknown)"}\n` +
    `Error:\n${parsed.normalizedMessage}\n\n` +
    `Log excerpt:\n${parsed.rawExcerpt.slice(0, 4000)}\n\n` +
    `File context (if any):\n${snippet.slice(0, 12_000)}`;

  let raw: string;
  if (hasGeminiApiKey()) {
    raw = await geminiJson(userPrompt);
  } else if (openaiKey()) {
    raw = await openaiJson(userPrompt);
  } else {
    throw new Error("Set GEMINI_API_KEY or OPENAI_API_KEY for LLM-assisted healer fixes.");
  }

  const json = extractJsonObject(raw);
  return parsePayload(json);
}
