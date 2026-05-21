/**
 * HTTP API for the self-healer — autofix over REST (plan, apply, pattern cache).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import { parseHealerBuffer } from "../healer/parseError.js";
import { computePatternHash } from "../healer/fingerprint.js";
import { requestLlmFix } from "../healer/llmPatch.js";
import { applyHealerFixPayload } from "../healer/applyPatch.js";
import {
  findCachedFix,
  upsertFixPattern,
  healerDbEnabled,
  getHealerPrisma,
} from "../healer/db.js";
import { isHealerFixPayload } from "../healer/types.js";

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  setCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody<T = unknown>(
  req: IncomingMessage
): Promise<T | null> {
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

function detectActiveProvider(): string {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.GROQ_API_KEY?.trim()) return "groq";
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim())
    return "gemini";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return "none";
}

type AutofixResult =
  | {
      ok: true;
      applied: boolean;
      provider: string;
      edits: unknown[];
      fromCache: boolean;
      patternHash: string;
    }
  | { ok: false; error: string };

async function runAutofix(
  logText: string,
  repoRoot: string,
  dryRun: boolean
): Promise<AutofixResult> {
  const parsed = parseHealerBuffer(logText);
  if (!parsed) {
    return {
      ok: false,
      error:
        "Could not detect a known error pattern in the provided log text. " +
        "Supported formats: TypeScript compile errors, Next.js errors, Python tracebacks.",
    };
  }

  const patternHash = computePatternHash(parsed, repoRoot);
  const provider = detectActiveProvider();

  let fromCache = false;
  let payload = null;

  const cached = await findCachedFix(patternHash, parsed.techStack);
  if (cached && isHealerFixPayload(cached.fixPayload)) {
    payload = cached.fixPayload;
    fromCache = true;
  }

  if (!payload) {
    if (provider === "none") {
      return {
        ok: false,
        error:
          "No LLM API key configured. Set ANTHROPIC_API_KEY, GROQ_API_KEY, " +
          "GEMINI_API_KEY, or OPENAI_API_KEY in your .env to enable AI-powered fixes.",
      };
    }
    try {
      payload = await requestLlmFix(repoRoot, parsed);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "LLM request failed.",
      };
    }
  }

  if (!payload || payload.edits.length === 0) {
    return {
      ok: false,
      error:
        "LLM could not determine a safe fix for this error (returned empty edits).",
    };
  }

  if (!dryRun) {
    try {
      await applyHealerFixPayload(repoRoot, payload);
    } catch (e) {
      return {
        ok: false,
        error: `Patch application failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    await upsertFixPattern({
      patternHash,
      techStack: parsed.techStack,
      primaryFilePath: parsed.primaryFilePath,
      normalizedSnippet: parsed.normalizedMessage,
      rawSnippetPreview: parsed.rawExcerpt.slice(0, 2000),
      fixPayload: payload,
      createdFrom: fromCache ? "CACHE" : "LLM",
      incrementSuccess: true,
    });
  }

  return {
    ok: true,
    applied: !dryRun,
    provider: fromCache ? "cache" : provider,
    edits: payload.edits,
    fromCache,
    patternHash,
  };
}

export async function handleHealerApiRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  if (!req.url) return false;
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/healer")) return false;

  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/healer/status") {
    sendJson(res, 200, {
      ok: true,
      llmProvider: detectActiveProvider(),
      dbEnabled: healerDbEnabled(),
      autoApplyEnabled: process.env.HEALER_AUTO_APPLY?.trim() === "1",
      allowPrefixes: (
        process.env.HEALER_ALLOW_PREFIXES?.split(",").map((s) => s.trim()) ?? [
          "src",
          "frontend",
          "ml",
        ]
      ),
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/healer/fix") {
    const body =
      (await readJsonBody<{ logText?: string; repoRoot?: string }>(req)) ?? {};
    const logText = body.logText?.trim();
    if (!logText || logText.length < 10) {
      sendJson(res, 400, {
        ok: false,
        error: "logText is required (paste your error log).",
      });
      return true;
    }

    const repoRoot = path.resolve(body.repoRoot?.trim() || process.cwd());
    const result = await runAutofix(logText, repoRoot, false);
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/healer/plan") {
    const body =
      (await readJsonBody<{ logText?: string; repoRoot?: string }>(req)) ?? {};
    const logText = body.logText?.trim();
    if (!logText || logText.length < 10) {
      sendJson(res, 400, {
        ok: false,
        error: "logText is required (paste your error log).",
      });
      return true;
    }

    const repoRoot = path.resolve(body.repoRoot?.trim() || process.cwd());
    const result = await runAutofix(logText, repoRoot, true);
    sendJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/healer/patterns") {
    const db = getHealerPrisma();
    if (!db) {
      sendJson(res, 200, {
        ok: true,
        dbEnabled: false,
        patterns: [],
        note: "Set DATABASE_URL to enable the fix-pattern cache.",
      });
      return true;
    }

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(url.searchParams.get("limit") ?? "40", 10) || 40
      )
    );

    const rows = await db.errorFixPattern.findMany({
      orderBy: { lastAppliedAt: "desc" },
      take: limit,
      select: {
        id: true,
        techStack: true,
        patternHash: true,
        primaryFilePath: true,
        normalizedSnippet: true,
        createdFrom: true,
        successCount: true,
        lastAppliedAt: true,
        createdAt: true,
      },
    });

    sendJson(res, 200, { ok: true, total: rows.length, patterns: rows });
    return true;
  }

  const deleteMatch = url.pathname.match(/^\/api\/healer\/patterns\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const id = deleteMatch[1];
    const db = getHealerPrisma();
    if (!db) {
      sendJson(res, 400, { ok: false, error: "DATABASE_URL not configured." });
      return true;
    }
    try {
      await db.errorFixPattern.delete({ where: { id } });
      sendJson(res, 200, { ok: true, deleted: id });
    } catch {
      sendJson(res, 404, {
        ok: false,
        error: `Pattern not found: ${id}`,
      });
    }
    return true;
  }

  sendJson(res, 404, { ok: false, error: "Not Found" });
  return true;
}
