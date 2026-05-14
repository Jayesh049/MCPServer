import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="about-section">
      <div className="hero-eyebrow">Project</div>
      <h2>Agents Assemble — 20-Disease MCP Tester</h2>
      <p>
        This UI is a manual test harness for the SHARP-on-MCP healthcare server. The server exposes 20 disease detection
        tools (12 imaging, 6 clinical, 2 signal), each running a deterministic{" "}
        <strong>detection → resolution → solution</strong> pipeline.
      </p>
      <p>
        Use only <strong>synthetic / non-PHI</strong> data. The hackathon explicitly disqualifies submissions that include
        real Protected Health Information.
      </p>
      <p>
        For imaging models, the current scaffold uses a deterministic image-hash score so the UI can be tested manually.
        Real pretrained / self-trained models can be wired into the backend without changing this shell.
      </p>
      <p>
        All 20 tools are also exposed via the MCP server (Streamable HTTP at <code>/mcp</code>) and over stdio for local
        clients.
      </p>

      <div className="det-section-title" style={{ marginTop: 28 }}>
        Pipeline Architecture
      </div>
      <div
        style={{
          background: "var(--deep)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 20,
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 12,
          lineHeight: 2,
          color: "var(--muted)"
        }}
      >
        <span style={{ color: "var(--accent)" }}>Input</span> (image | form | signal)
        <br />
        &nbsp;→ <span style={{ color: "var(--gold)" }}>Model Inference</span> (CNN | tabular | signal-ML)
        <br />
        &nbsp;→ <span style={{ color: "var(--violet)" }}>Prediction</span> (classification, confidence, risk level)
        <br />
        &nbsp;→ <span style={{ color: "var(--warn)" }}>Resolution</span> (risk-stratified steps)
        <br />
        &nbsp;→ <span style={{ color: "var(--emerald)" }}>Solution</span> (actions, follow-up, patient ed.)
        <br />
        &nbsp;→ <span style={{ color: "var(--coral)" }}>Care Plan</span> (doctors, exercises, affirmations)
      </div>

      <div className="det-section-title" style={{ marginTop: 28 }}>
        Tech Stack
      </div>
      <div className="tech-grid">
        <div className="tech-card">
          <div className="tech-card-icon">⚡</div>
          <div className="tech-card-name">Next.js</div>
          <div className="tech-card-desc">App Router, Server Components, TypeScript</div>
        </div>
        <div className="tech-card">
          <div className="tech-card-icon">🔗</div>
          <div className="tech-card-name">MCP Protocol</div>
          <div className="tech-card-desc">20 disease tools exposed as MCP endpoints</div>
        </div>
        <div className="tech-card">
          <div className="tech-card-icon">🧠</div>
          <div className="tech-card-name">AI Pipeline</div>
          <div className="tech-card-desc">Detection → Resolution → Solution</div>
        </div>
        <div className="tech-card">
          <div className="tech-card-icon">🏥</div>
          <div className="tech-card-name">RAG Chat</div>
          <div className="tech-card-desc">Wikipedia-style notes, multi-language</div>
        </div>
        <div className="tech-card">
          <div className="tech-card-icon">📄</div>
          <div className="tech-card-name">Report Analyzer</div>
          <div className="tech-card-desc">PDF and structured report parsing</div>
        </div>
        <div className="tech-card">
          <div className="tech-card-icon">🔒</div>
          <div className="tech-card-name">Synthetic Only</div>
          <div className="tech-card-desc">Zero PHI — demo data is fictional</div>
        </div>
      </div>

      <p style={{ marginTop: 28 }}>
        <Link href="/" className="btn-primary">
          ← Back to diseases
        </Link>
      </p>
    </div>
  );
}
