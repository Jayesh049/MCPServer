/**
 * Delegates RAG tool calls to the Python agent when AGENT_RAG_URL is set.
 */

function baseUrl(): string | undefined {
  const raw = process.env.AGENT_RAG_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

function agentHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.AGENT_RAG_SECRET?.trim();
  if (secret) h["X-Agent-Key"] = secret;
  return h;
}

export function isAgentRagEnabled(): boolean {
  return Boolean(baseUrl());
}

export async function callAgentWebRag(question: string, refresh?: boolean): Promise<unknown> {
  const b = baseUrl();
  if (!b) throw new Error("AGENT_RAG_URL is not set");
  const r = await fetch(`${b}/v1/rag/ask`, {
    method: "POST",
    headers: agentHeaders(),
    body: JSON.stringify({ question, refresh: refresh === true })
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Agent RAG HTTP ${r.status}: ${text.slice(0, 2000)}`);
  }
  return JSON.parse(text) as unknown;
}

export async function callAgentBankRag(slug: string, refresh?: boolean): Promise<unknown> {
  const b = baseUrl();
  if (!b) throw new Error("AGENT_RAG_URL is not set");
  const r = await fetch(`${b}/v1/rag/bank`, {
    method: "POST",
    headers: agentHeaders(),
    body: JSON.stringify({ slug, refresh: refresh === true })
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Agent bank RAG HTTP ${r.status}: ${text.slice(0, 2000)}`);
  }
  return JSON.parse(text) as unknown;
}
