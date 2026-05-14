import { createHash } from "node:crypto";

import type { ParsedHealerError } from "./types.js";

/** Strip volatile bits (abs paths → REL) for stable cache keys. */
export function normalizePathForFingerprint(repoRoot: string, absOrRel: string): string {
  const norm = absOrRel.replace(/\\/g, "/").trim();
  const root = repoRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (norm.toLowerCase().startsWith(root.toLowerCase() + "/")) {
    return norm.slice(root.length + 1);
  }
  return norm.replace(/^[A-Za-z]:\//, "").replace(/^\/+/, "");
}

export function computePatternHash(parsed: ParsedHealerError, repoRoot: string): string {
  const file = parsed.primaryFilePath
    ? normalizePathForFingerprint(repoRoot, parsed.primaryFilePath)
    : "";
  const line = parsed.primaryLine ?? "";
  const key = `${parsed.techStack}|${file}|${line}|${parsed.normalizedMessage}`;
  return createHash("sha256").update(key, "utf8").digest("hex").slice(0, 48);
}
