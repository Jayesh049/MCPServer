"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

const LANGUAGES = [
  { value: "English", label: "English (output is plain English)" },
  { value: "Hindi", label: "Hindi — we still reply in English; translate locally" },
  { value: "Tamil", label: "Tamil — we still reply in English; translate locally" },
  { value: "Telugu", label: "Telugu — we still reply in English; translate locally" },
  { value: "Bengali", label: "Bengali — we still reply in English; translate locally" },
  { value: "Spanish", label: "Spanish — we still reply in English; translate locally" },
  { value: "French", label: "French — we still reply in English; translate locally" },
  { value: "Arabic", label: "Arabic — we still reply in English; translate locally" }
];

type PatientChatApi = {
  ok: boolean;
  patientText?: string;
  requestedLanguage?: string;
  sourcesUsed?: string[];
  disclaimer?: string;
  languageNote?: string;
  error?: string;
  rawRag?: unknown;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf("base64,");
      resolve(i >= 0 ? s.slice(i + 7) : s);
    };
    r.onerror = () => reject(new Error("File read failed"));
    r.readAsDataURL(file);
  });
}

export default function PatientChatPage() {
  const [language, setLanguage] = useState("English");
  const [message, setMessage] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [includeRaw, setIncludeRaw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<PatientChatApi | null>(null);

  const onSubmit = useCallback(async () => {
    setError(null);
    setReply(null);
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setError("Please enter a question (at least 3 characters).");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        message: trimmed,
        language,
        includeRawRag: includeRaw
      };
      if (pdfFile) {
        body.pdfBase64 = await readFileAsBase64(pdfFile);
        body.pdfFilename = pdfFile.name;
      }
      if (imageFile) {
        body.imageBase64 = await readFileAsBase64(imageFile);
        body.imageMimeType = imageFile.type || "application/octet-stream";
      }

      const res = await fetch("/api/chat/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as PatientChatApi;
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setReply(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [message, language, pdfFile, imageFile, includeRaw]);

  return (
    <div className="chat-layout">
      <div className="chat-messages">
        <div className="chat-bubble assistant">
          <div className="bubble-src">🏥 Agents Assemble — Patient Chat</div>
          Ask in your own words. You can add a PDF (text is read) or attach an image (we{" "}
          <strong>cannot</strong> read the picture in this mode — describe it if it matters). Answers use{" "}
          <strong>very simple English</strong> from Wikipedia-style notes. <em>Not medical advice.</em>
        </div>

        {error ? (
          <div className="chat-bubble assistant" role="alert">
            <div className="bubble-src">Error</div>
            {error}
          </div>
        ) : null}

        {reply?.patientText ? (
          <div className="chat-bubble assistant">
            <div className="bubble-src">Plain answer</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{reply.patientText}</div>
            {reply.languageNote ? <p className="muted" style={{ marginTop: 12 }}>{reply.languageNote}</p> : null}
            {reply.sourcesUsed?.length ? (
              <p className="muted" style={{ marginTop: 8 }}>
                Sources: {reply.sourcesUsed.join(", ")}
              </p>
            ) : null}
            <p className="muted" style={{ marginTop: 12, fontWeight: 600 }}>
              {reply.disclaimer}
            </p>
            {reply.rawRag ? (
              <details style={{ marginTop: 16 }}>
                <summary className="muted">Raw RAG payload</summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    maxHeight: 320,
                    overflow: "auto",
                    marginTop: 8,
                    fontFamily: "var(--font-mono), ui-monospace, monospace"
                  }}
                >
                  {JSON.stringify(reply.rawRag, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="chat-footer">
        <div style={{ marginBottom: 10 }}>
          <Link href="/" className="subtle">
            ← Disease hub
          </Link>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            Language:
            <select
              className="form-select"
              style={{ width: "auto", minWidth: 200, padding: "6px 10px", fontSize: 12 }}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            PDF (optional)
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            Image (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {(pdfFile || imageFile) && (
          <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            {pdfFile ? `PDF: ${pdfFile.name}` : null}
            {pdfFile && imageFile ? " · " : null}
            {imageFile ? `Image: ${imageFile.name} (not analyzed visually)` : null}
          </p>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }} className="muted">
          <input type="checkbox" checked={includeRaw} onChange={(e) => setIncludeRaw(e.target.checked)} />
          <span style={{ fontSize: 12 }}>Include raw RAG JSON (large; for debugging)</span>
        </label>

        <div className="chat-input-wrap">
          <textarea
            className="chat-textarea"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask in your own words, e.g. 'What is high blood pressure?'"
          />
          <button type="button" className="chat-send" onClick={onSubmit} disabled={loading} aria-label="Send">
            {loading ? (
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16" aria-hidden>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 8 }}>
          Uses RAG over Wikipedia-style disease notes. Not medical advice.
        </p>
      </div>
    </div>
  );
}
