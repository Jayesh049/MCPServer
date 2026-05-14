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
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/" className="subtle">
          ← All diseases
        </Link>
      </div>

      <section className="hero">
        <h1>Simple patient chat</h1>
        <p className="muted">
          Ask in your own words. You can add a PDF (text is read) or attach an image (we{" "}
          <strong>cannot</strong> read the picture in this mode — describe it if it matters).
          Answers use <strong>very simple English</strong> from Wikipedia-style notes. Not
          medical advice.
        </p>
      </section>

      <div className="panel" style={{ marginBottom: 20 }}>
        <label className="label">Language you use (for our records only)</label>
        <select
          className="input"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{ maxWidth: 420, marginBottom: 16 }}
        >
          {LANGUAGES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="label">Your question</label>
        <textarea
          className="input"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Example: What is high blood pressure? Should I worry about salt?"
          style={{ width: "100%", marginBottom: 16, resize: "vertical" }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
          <div>
            <label className="label">PDF (optional)</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
            {pdfFile ? (
              <div className="muted" style={{ marginTop: 6 }}>
                Selected: {pdfFile.name}
              </div>
            ) : null}
          </div>
          <div>
            <label className="label">Image (optional — not analyzed visually)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {imageFile ? (
              <div className="muted" style={{ marginTop: 6 }}>
                Selected: {imageFile.name} (name only; add a text description in your question if
                needed)
              </div>
            ) : null}
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={includeRaw}
            onChange={(e) => setIncludeRaw(e.target.checked)}
          />
          <span className="muted">Include raw RAG JSON (large; for debugging)</span>
        </label>

        <button type="button" className="btn" onClick={onSubmit} disabled={loading}>
          {loading ? "Working…" : "Get simple answer"}
        </button>
      </div>

      {error ? (
        <div className="panel" style={{ borderColor: "var(--bad)" }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {reply?.patientText ? (
        <div className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Plain answer</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 15,
              lineHeight: 1.55,
              margin: 0
            }}
          >
            {reply.patientText}
          </pre>
          {reply.languageNote ? (
            <p className="muted" style={{ marginTop: 14 }}>
              {reply.languageNote}
            </p>
          ) : null}
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
                  marginTop: 8
                }}
              >
                {JSON.stringify(reply.rawRag, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
