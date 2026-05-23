/** Trim trailing slash from API base URL. */
function trimBase(url: string): string {
  return url.replace(/\/$/, "");
}

/** Server / build (RSC, rewrites). Set MCP_API_BASE_URL on Vercel. */
export function getServerApiBase(): string {
  return trimBase(process.env.MCP_API_BASE_URL ?? "http://127.0.0.1:3333");
}

/**
 * Browser: when NEXT_PUBLIC_MCP_API_BASE_URL is set, call Render directly.
 * Avoids Vercel proxy timeouts on long Wikipedia RAG + LLM chat (10s hobby limit).
 */
export function getBrowserApiBase(): string {
  const pub = process.env.NEXT_PUBLIC_MCP_API_BASE_URL?.trim();
  return pub ? trimBase(pub) : "";
}

/** Client fetch path — direct Render URL in production, relative /api in local dev. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    const base = getBrowserApiBase();
    return base ? `${base}${p}` : p;
  }
  return `${getServerApiBase()}${p}`;
}
