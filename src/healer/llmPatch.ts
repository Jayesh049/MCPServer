/**
 * llmPatch.ts — FIXED VERSION
 *
 * Adds provider auto-selection so the healer uses whatever API key you have:
 *   ANTHROPIC_API_KEY  → Claude (best code understanding)
 *   GROQ_API_KEY       → Llama 3.1 70B (free tier, fast)
 *   GEMINI_API_KEY     → Gemini 1.5 Flash (free tier)
 *   OPENAI_API_KEY     → GPT-4o-mini
 *
 * Priority: Anthropic > Groq > Gemini > OpenAI
 * Same key priority as patientChat.ts so you only need to set one key.
 */

import fs from "node:fs/promises";
import path from "node:path";

import type { HealerFixPayload } from "./types.js";
import { isHealerFixPayload } from "./types.js";
import type { ParsedHealerError } from "./types.js";

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

type Provider = "anthropic" | "groq" | "gemini" | "openai" | "none";

function detectProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return "none";
}

// ---------------------------------------------------------------------------
// Shared system prompt — tells the LLM to output clean JSON only
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert TypeScript/Python developer that fixes runtime and compile errors.
Reply with ONLY valid JSON (no markdown fences, no explanation) matching this exact shape:
{"edits":[{"path":"relative/path/from/repo/root","search":"exact substring to replace once","replace":"new substring"}]}

Rules:
- path must use forward slashes, relative to repo root, only under src/, frontend/, or ml/
- search must match EXACTLY ONCE in that file — copy it character-for-character from the file context
- replace must fix the reported error with the minimal possible change
- If you cannot safely fix the error, return {"edits":[]}
- Never return anything except the JSON object`;

// ---------------------------------------------------------------------------
// File context reader
// ---------------------------------------------------------------------------

async function readSnippet(
  repoRoot: string,
  relPath: string | null,
  line: number | null
): Promise<string> {
  if (!relPath) return "";
  const abs = path.resolve(repoRoot, relPath.replace(/\\/g, "/"));
  try {
    const text = await fs.readFile(abs, "utf8");
    const lines = text.split("\n");
    if (line !== null && line >= 1 && line <= lines.length) {
      const lo = Math.max(0, line - 10);
      const hi = Math.min(lines.length, line + 10);
      return lines.slice(lo, hi).map((l, i) => `${lo + i + 1}: ${l}`).join("\n");
    }
    return lines.slice(0, 50).map((l, i) => `${i + 1}: ${l}`).join("\n");
  } catch {
    return "";
  }
}

function buildUserPrompt(
  repoRoot: string,
  parsed: ParsedHealerError,
  snippet: string
): string {
  return [
    `Repo root: ${repoRoot}`,
    `Tech stack: ${parsed.techStack}`,
    `Primary file: ${parsed.primaryFilePath ?? "(unknown)"}`,
    `Line: ${parsed.primaryLine ?? "(unknown)"}`,
    ``,
    `Error message:`,
    parsed.normalizedMessage,
    ``,
    `Full log excerpt:`,
    parsed.rawExcerpt.slice(0, 4000),
    snippet ? `\nFile context (lines around the error):\n${snippet.slice(0, 8000)}` : "",
  ]
    .filter((x) => x !== undefined)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function callAnthropic(userPrompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY!.trim();
  // Use Sonnet for code fixes — better reasoning than Haiku for this task
  const model =
    process.env.HEALER_ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic healer error (${res.status}): ${err.slice(0, 600)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ text?: string }>;
  };
  return data.content?.[0]?.text?.trim() ?? "";
}

/**
 * Groq — FREE tier, Llama 3.1 70B. Fast and good at structured output.
 * Get key: https://console.groq.com/keys
 */
async function callGroq(userPrompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY!.trim();
  const model =
    process.env.HEALER_GROQ_MODEL?.trim() || "llama-3.1-70b-versatile";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Groq healer error (${res.status}): ${err.slice(0, 600)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Gemini 1.5 Flash — FREE tier.
 * Get key: https://aistudio.google.com/apikey
 */
async function callGemini(userPrompt: string): Promise<string> {
  const key = (
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  )!.trim();
  const model =
    process.env.HEALER_GEMINI_MODEL?.trim() ||
    process.env.GEMINI_GENERATE_MODEL?.trim() ||
    "gemini-1.5-flash";

  const m = model.includes("/") ? model.split("/").pop()! : model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini healer error (${res.status}): ${err.slice(0, 600)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const parts = data.candidates?.[0]?.content?.parts;
  return parts?.map((p) => p.text ?? "").join("") ?? "";
}

async function callOpenAI(userPrompt: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY!.trim();
  const model = process.env.HEALER_OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI healer error (${res.status}): ${err.slice(0, 600)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// JSON extraction + validation
// ---------------------------------------------------------------------------

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
    throw new Error("LLM returned non-JSON for healer fix.");
  }
  if (!isHealerFixPayload(parsed)) {
    throw new Error(
      "LLM JSON does not match { edits: [{ path, search, replace }] }."
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function requestLlmFix(
  repoRoot: string,
  parsed: ParsedHealerError
): Promise<HealerFixPayload> {
  const provider = detectProvider();
  if (provider === "none") {
    throw new Error(
      "No LLM API key found for healer. Set ANTHROPIC_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY."
    );
  }

  const snippet = await readSnippet(
    repoRoot,
    parsed.primaryFilePath,
    parsed.primaryLine
  );
  const userPrompt = buildUserPrompt(repoRoot, parsed, snippet);

  console.error(`[healer] requesting LLM fix via ${provider}…`);

  let raw: string;
  switch (provider) {
    case "anthropic": raw = await callAnthropic(userPrompt); break;
    case "groq":      raw = await callGroq(userPrompt); break;
    case "gemini":    raw = await callGemini(userPrompt); break;
    case "openai":    raw = await callOpenAI(userPrompt); break;
    default:
      throw new Error("unreachable");
  }

  const json = extractJsonObject(raw);
  const payload = parsePayload(json);

  // Log the plan so the developer can see what will change
  console.error(
    `[healer] LLM (${provider}) proposed ${payload.edits.length} edit(s):`
  );
  for (const ed of payload.edits) {
    console.error(`  • ${ed.path}  [search ${ed.search.slice(0, 60).replace(/\n/g, "↵")}…]`);
  }

  return payload;
}
