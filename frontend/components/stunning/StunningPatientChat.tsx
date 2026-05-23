"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api-base";

type ChatTurn = { role: "user" | "assistant"; content: string };

type PatientChatApi = {
  ok: boolean;
  patientText?: string;
  sourcesUsed?: string[];
  llmProvider?: string;
  error?: string;
};

const SOURCE_LABELS: Record<string, string> = {
  web_rag: "📖 Wikipedia RAG",
  pdf_excerpt: "📄 PDF",
  llm_groq: "🤖 Groq",
  llm_gemini: "🤖 Gemini",
  llm_anthropic: "🤖 Claude",
  llm_openai: "🤖 OpenAI"
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s;
}

type Msg = { role: "user" | "ai"; text: string; sources: string[] };

const WELCOME: Msg = {
  role: "ai",
  text:
    "Hello — I'm your patient education assistant. Ask me about any health condition, medication, or symptom. I search Wikipedia's medical articles and synthesize a plain-language answer.",
  sources: ["web_rag"]
};

export function StunningPatientChat() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmBadge, setLlmBadge] = useState("🤖 LLM: detecting…");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch(apiUrl("/api/healer/status"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { llmProvider?: string } | null) => {
        if (d?.llmProvider) setLlmBadge(`🤖 LLM: ${d.llmProvider}`);
        else setLlmBadge("🤖 Set GROQ_API_KEY (then GEMINI)");
      })
      .catch(() => setLlmBadge("🤖 Set GROQ_API_KEY (then GEMINI)"));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg, sources: [] }]);
    const nextHistory: ChatTurn[] = [...history, { role: "user", content: msg }];
    setHistory(nextHistory);
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/chat/patient"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: nextHistory.slice(-6) })
      });
      const data = (await res.json()) as PatientChatApi;
      const text = data.patientText ?? data.error ?? "No response.";
      setHistory((h) => [...h, { role: "assistant", content: text }]);
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text,
          sources: data.sourcesUsed ?? (data.llmProvider ? [`llm_${data.llmProvider}`] : [])
        }
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text:
            "Could not reach the API. On Vercel set NEXT_PUBLIC_MCP_API_BASE_URL to your Render URL and redeploy. Locally run `npm run dev` (port 3333).",
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, history]);

  return (
    <div className="chat-w" style={{ minHeight: "calc(100vh - 220px)" }}>
      <div className="sec-h" style={{ flexShrink: 0 }}>
        <div>
          <div className="sec-title">Patient Chat</div>
          <div className="sec-sub">Wikipedia RAG + LLM synthesis · multi-turn conversation</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
          <span className="src-pill">📖 Wikipedia RAG</span>
          <span className="src-pill" style={{ color: "var(--acc)" }}>
            {llmBadge}
          </span>
        </div>
      </div>

      <div className="chat-msgs" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`cmsg ${m.role === "user" ? "u" : ""}`}>
            <div className={`cav ${m.role === "ai" ? "ai" : "u"}`}>{m.role === "ai" ? "🧬" : "👤"}</div>
            <div>
              <div className={`cbub ${m.role === "user" ? "u" : ""}`} style={{ whiteSpace: "pre-wrap" }}>
                {m.text}
              </div>
              {m.sources.length > 0 ? (
                <div className="csrc">
                  {m.sources.map((s) => (
                    <span key={s} className={`src-pill ${m.role === "ai" ? "" : "gold"}`}>
                      {sourceLabel(s)}
                    </span>
                  ))}
                  {m.role === "ai" ? (
                    <span className="src-pill gold">Education only · not clinical advice</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? (
          <div className="cmsg">
            <div className="cav ai">🧬</div>
            <div className="cbub" style={{ color: "var(--txt3)" }}>
              <span className="spin" /> Thinking…
            </div>
          </div>
        ) : null}
      </div>

      <div className="cin-wrap">
        <textarea
          className="cin"
          rows={1}
          value={input}
          placeholder="Ask a health question…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" className="btn btn-p" onClick={() => void send()} disabled={loading}>
          Send ↗
        </button>
      </div>
    </div>
  );
}
