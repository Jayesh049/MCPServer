/** Static discovery for demos / judges (no secrets). MCP lives on `/mcp` on the same port. */

export function getApiDiscovery() {
  return {
    service: "agents-assemble-sharp-mcp",
    mcp: {
      protocol: "MCP Streamable HTTP",
      path: "/mcp",
      note: "Register full URL https://YOUR_HOST/mcp in Prompt Opinion (Streamable HTTP)."
    },
    rest: [
      { method: "GET", path: "/api", description: "This index." },
      { method: "GET", path: "/api/health", description: "Liveness." },
      { method: "GET", path: "/api/diseases", description: "List disease slugs." },
      { method: "GET", path: "/api/qa/info", description: "Examples for unified ask." },
      { method: "POST", path: "/api/qa/ask", description: "Unified ask→answer." },
      { method: "POST", path: "/api/v1/ask", description: "Alias of /api/qa/ask." },
      {
        method: "POST",
        path: "/api/chat/patient",
        description:
          "Patient-style plain English: { message, language?, pdfBase64?, imageBase64?, includeRawRag? }. No external LLM; no image vision."
      },
      { method: "GET", path: "/api/rag/catalog", description: "Manual q2–q4 + bank qb_*." },
      { method: "GET", path: "/api/questions", description: "DB Question rows." },
      { method: "GET", path: "/api/answers", description: "?limit= Recent Answer rows." },
      { method: "POST", path: "/api/rag/ask", description: "Free-form Wikipedia RAG." },
      { method: "POST", path: "/api/rag/ask-bank", description: "{ slug: qb_XXX }." },
      { method: "POST", path: "/api/rag/train-bank", description: "Start training bank (async). Returns { started, runId? }." },
      { method: "GET", path: "/api/rag/train-bank/runs", description: "List recent training runs (poll status)." },
      { method: "GET", path: "/api/manual/questions", description: "Manual question prompts." },
      { method: "POST", path: "/api/manual/q2", description: "{ diseaseSlug }." },
      { method: "POST", path: "/api/manual/q3", description: "{ diseaseSlug, stage }." },
      { method: "POST", path: "/api/manual/q4", description: "{ pdfText | pdfBase64 }." },
      { method: "POST", path: "/api/report/analyze", description: "Report → diseases + optional care plan." },
      { method: "GET", path: "/api/healer/status", description: "Self-healer: active LLM provider + DB cache." },
      { method: "POST", path: "/api/healer/plan", description: "Self-healer dry-run: { logText } → proposed edits." },
      { method: "POST", path: "/api/healer/fix", description: "Self-healer: parse log, LLM/cache patch, apply." },
      { method: "GET", path: "/api/healer/patterns", description: "Cached ErrorFixPattern rows (?limit=)." },
      { method: "DELETE", path: "/api/healer/patterns/:id", description: "Remove a cached fix pattern." }
    ],
    fhirHeadersOptional: ["X-FHIR-Server-URL", "X-FHIR-Access-Token", "X-Patient-ID"]
  };
}
