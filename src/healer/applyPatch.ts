import fs from "node:fs/promises";
import path from "node:path";

import type { HealerFixPayload } from "./types.js";
import { isHealerFixPayload } from "./types.js";

function isPathInsideRoot(absFile: string, repoRoot: string): boolean {
  const rel = path.relative(repoRoot, absFile);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function defaultAllowPrefixes(): string[] {
  const raw = process.env.HEALER_ALLOW_PREFIXES?.trim();
  if (raw) {
    return raw.split(",").map((s) => s.trim().replace(/\\/g, "/").replace(/^\/+/, ""));
  }
  return ["src", "frontend", "ml"];
}

function isAllowedRelative(relPosix: string, allow: string[]): boolean {
  const n = relPosix.replace(/^\/+/, "");
  return allow.some((p) => n === p || n.startsWith(`${p}/`));
}

/** Apply search/replace edits. Throws if path escapes repo or prefix deny. */
export async function applyHealerFixPayload(
  repoRoot: string,
  payload: HealerFixPayload,
  allowPrefixes = defaultAllowPrefixes()
): Promise<void> {
  if (!isHealerFixPayload(payload)) {
    throw new Error("Invalid fix payload shape.");
  }
  for (const ed of payload.edits) {
    const rel = ed.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!rel || rel === "." || rel.includes("..")) {
      throw new Error(`Invalid edit path: ${ed.path}`);
    }
    if (!isAllowedRelative(rel, allowPrefixes)) {
      throw new Error(`Path not allowed by HEALER_ALLOW_PREFIXES: ${rel}`);
    }
    const abs = path.resolve(repoRoot, rel);
    if (!isPathInsideRoot(abs, repoRoot)) {
      throw new Error(`Path escapes repo root: ${rel}`);
    }
    const content = await fs.readFile(abs, "utf8");
    if (!content.includes(ed.search)) {
      throw new Error(`search string not found in ${rel}`);
    }
    const count = content.split(ed.search).length - 1;
    if (count !== 1) {
      throw new Error(`Expected exactly 1 occurrence of search in ${rel}, found ${count}`);
    }
    const next = content.replace(ed.search, ed.replace);
    await fs.writeFile(abs, next, "utf8");
  }
}

export function payloadFromRowJson(raw: unknown): HealerFixPayload {
  if (!isHealerFixPayload(raw)) {
    throw new Error("Stored fixPayload is invalid.");
  }
  return raw;
}
