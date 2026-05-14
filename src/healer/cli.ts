#!/usr/bin/env node
import "dotenv/config";

/**
 * Self-healing dev orchestrator: tail supervised process logs, match cached fixes (Postgres),
 * optionally call Gemini/OpenAI for patches, apply edits, restart when needed.
 *
 * Usage:
 *   tsx src/healer/cli.ts [--plan-only] [--cwd <repoRoot>] -- <command> [args...]
 *
 * Examples:
 *   tsx src/healer/cli.ts -- npm run dev
 *   tsx src/healer/cli.ts --plan-only -- npm run dev
 *
 * Env:
 *   HEALER_AUTO_APPLY=1          — required to write files (otherwise log only)
 *   HEALER_DEBOUNCE_MS=2000
 *   HEALER_MAX_RETRIES_PER_PATTERN=3
 *   HEALER_FORCE_RESTART=auto|0|1  — auto: no restart for watch/next dev
 *   HEALER_ALLOW_PREFIXES=src,frontend,ml
 *   DATABASE_URL                 — optional; enables ErrorFixPattern cache
 *   GEMINI_API_KEY / OPENAI_API_KEY — for novel errors
 */

import { computePatternHash } from "./fingerprint.js";
import { applyHealerFixPayload } from "./applyPatch.js";
import {
  disconnectHealerDb,
  findCachedFix,
  healerDbEnabled,
  upsertFixPattern
} from "./db.js";
import { runDeterministicFixes } from "./deterministic.js";
import { requestLlmFix } from "./llmPatch.js";
import type { ParsedHealerError } from "./types.js";
import { isHealerFixPayload } from "./types.js";
import { superviseDevProcess } from "./supervisor.js";

function parseArgs(argv: string[]): {
  planOnly: boolean;
  cwd: string;
  commandParts: string[];
} {
  const dash = argv.indexOf("--");
  const head = dash >= 0 ? argv.slice(0, dash) : argv;
  const tail = dash >= 0 ? argv.slice(dash + 1) : [];

  let planOnly = false;
  let cwd = process.cwd();
  const optHead: string[] = [];
  for (let i = 0; i < head.length; i++) {
    const a = head[i];
    if (a === "--plan-only") planOnly = true;
    else if (a === "--cwd" && head[i + 1]) {
      cwd = head[++i] ?? cwd;
    } else optHead.push(a ?? "");
  }

  let commandParts = tail;
  if (commandParts.length === 0) {
    const hc = process.env.HEALER_COMMAND?.trim();
    if (hc) {
      commandParts = hc.split(/\s+/).filter(Boolean);
    }
  }
  if (optHead.length > 0 && optHead.some((x) => x)) {
    console.warn("[healer] ignoring unknown flags:", optHead.join(" "));
  }
  return { planOnly, cwd, commandParts };
}

function shouldForceRestart(commandParts: string[]): boolean {
  const env = process.env.HEALER_FORCE_RESTART?.trim().toLowerCase();
  if (env === "1" || env === "true") return true;
  if (env === "0" || env === "false") return false;
  const joined = commandParts.join(" ");
  if (/watch|next\s+dev|next\s+dev\b|turbopack/i.test(joined)) return false;
  return true;
}

function printUsage(): void {
  console.log(`Usage: tsx src/healer/cli.ts [--plan-only] [--cwd <dir>] -- <command> [args...]
Or set HEALER_COMMAND to a shell string when omitting arguments after --.

HEALER_AUTO_APPLY=1 is required to modify files.`);
}

export async function main(): Promise<void> {
  const { planOnly, cwd, commandParts } = parseArgs(process.argv.slice(2));
  if (commandParts.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const debounceMs = Number(process.env.HEALER_DEBOUNCE_MS ?? 2000);
  const maxRetries = Number(process.env.HEALER_MAX_RETRIES_PER_PATTERN ?? 3);
  const autoApply =
    !planOnly &&
    (process.env.HEALER_AUTO_APPLY ?? "").trim() === "1";

  if (!planOnly && !autoApply) {
    console.warn(
      "[healer] Dry-run: set HEALER_AUTO_APPLY=1 to apply patches, or pass --plan-only explicitly."
    );
  }

  const [exe, ...args] = commandParts;
  if (!exe) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const forceRestart = shouldForceRestart(commandParts);
  const retryMap = new Map<string, number>();
  const lastEmit = new Map<string, number>();

  const handleParsed = async (parsed: ParsedHealerError): Promise<void> => {
    const patternHash = computePatternHash(parsed, cwd);
    const now = Date.now();
    const last = lastEmit.get(patternHash) ?? 0;
    if (now - last < debounceMs) return;
    lastEmit.set(patternHash, now);

    const tries = retryMap.get(patternHash) ?? 0;
    if (tries >= maxRetries) {
      console.error(`[healer] max retries (${maxRetries}) for pattern ${patternHash.slice(0, 12)}… — skipping`);
      return;
    }

    console.error(
      `[healer] detected (${parsed.techStack}) ${parsed.normalizedMessage.slice(0, 200)}…`
    );

    const ranDeterministic = runDeterministicFixes(cwd, parsed.primaryFilePath, parsed.techStack);
    if (ranDeterministic) {
      console.error("[healer] ran eslint/ruff --fix on primary file (if applicable).");
      if (!forceRestart) {
        return;
      }
    }

    let payload: import("./types.js").HealerFixPayload | null = null;
    let fixOrigin: "CACHE" | "LLM" = "LLM";

    const cached = await findCachedFix(patternHash, parsed.techStack);
    if (cached && isHealerFixPayload(cached.fixPayload)) {
      payload = cached.fixPayload;
      fixOrigin = "CACHE";
      console.error("[healer] using cached fix from DB.");
    }

    if (!payload) {
      try {
        payload = await requestLlmFix(cwd, parsed);
        fixOrigin = "LLM";
      } catch (e) {
        console.error("[healer] LLM fix failed:", e);
        retryMap.set(patternHash, tries + 1);
        return;
      }
    }

    if (!payload || payload.edits.length === 0) {
      retryMap.set(patternHash, tries + 1);
      return;
    }

    if (planOnly || !autoApply) {
      console.error("[healer] plan-only / no auto-apply — would apply edits:", JSON.stringify(payload, null, 2));
      return;
    }

    try {
      await applyHealerFixPayload(cwd, payload);
      console.error("[healer] applied fix successfully.");
      retryMap.delete(patternHash);
      await upsertFixPattern({
        patternHash,
        techStack: parsed.techStack,
        primaryFilePath: parsed.primaryFilePath,
        normalizedSnippet: parsed.normalizedMessage,
        rawSnippetPreview: parsed.rawExcerpt.slice(0, 2000),
        fixPayload: payload,
        createdFrom: fixOrigin === "CACHE" ? "CACHE" : "LLM",
        incrementSuccess: true
      });
    } catch (e) {
      console.error("[healer] apply failed:", e);
      retryMap.set(patternHash, tries + 1);
      return;
    }

    if (forceRestart && currentChild) {
      console.error("[healer] restarting supervised process…");
      currentChild.kill("SIGTERM");
    }
  };

  let currentChild: ReturnType<typeof superviseDevProcess>["child"] | null = null;
  let stopSupervisor: (() => void) | null = null;
  let stopping = false;

  const shutdown = async () => {
    stopping = true;
    stopSupervisor?.();
    await disconnectHealerDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  if (healerDbEnabled()) {
    console.error("[healer] DATABASE_URL set — error pattern cache enabled.");
  } else {
    console.error("[healer] no DATABASE_URL — skipping DB cache (LLM only for novel errors).");
  }

  const loop = (): void => {
    const { child, stop } = superviseDevProcess({
      cwd,
      command: exe,
      args,
      debounceMs,
      onParsedError: handleParsed,
      forwardStreams: true
    });
    currentChild = child;
    stopSupervisor = stop;

    child.on("exit", (code, signal) => {
      if (stopping) return;
      console.error(`[healer] child exited code=${code} signal=${signal ?? ""} — respawning in 1s`);
      setTimeout(loop, 1000);
    });
  };

  loop();
}

void main();
