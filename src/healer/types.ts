/** Mirrors `HealerTechStack` in Prisma — keep in sync. */
export type HealerTechStack = "NODE_TS" | "NEXT" | "PYTHON";

/** Structured fix applied to the repo (search/replace per file). */
export type HealerFixPayload = {
  edits: Array<{
    path: string;
    search: string;
    replace: string;
  }>;
};

export type ParsedHealerError = {
  techStack: HealerTechStack;
  /** Repo-relative primary file, forward slashes. */
  primaryFilePath: string | null;
  primaryLine: number | null;
  /** Human-readable normalized message for cache key + LLM. */
  normalizedMessage: string;
  /** Short raw excerpt for DB preview. */
  rawExcerpt: string;
};

export function isHealerFixPayload(x: unknown): x is HealerFixPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as { edits?: unknown };
  if (!Array.isArray(o.edits)) return false;
  for (const e of o.edits) {
    if (!e || typeof e !== "object") return false;
    const r = e as { path?: unknown; search?: unknown; replace?: unknown };
    if (typeof r.path !== "string" || typeof r.search !== "string" || typeof r.replace !== "string") {
      return false;
    }
  }
  return true;
}
