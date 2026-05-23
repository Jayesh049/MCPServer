export function StunningCredentials() {
  return (
    <>
      <div
        style={{
          fontFamily: "var(--font-display), serif",
          fontSize: 17,
          fontWeight: 700,
          color: "var(--txt)",
          marginBottom: 14
        }}
      >
        Credentials — kab chahiye?
      </div>

      <div className="tok-grid" style={{ marginBottom: 28 }}>
        <div className="tok-c free">
          <div style={{ fontSize: 20, marginBottom: 8 }}>🗄</div>
          <div className="tok-name">DATABASE_URL — zaroori (history + RAG)</div>
          <div className="tok-desc">
            Patient chat history, embeddings, healer cache. Bina iske history page khali rahega.
          </div>
          <div className="tok-env" style={{ color: "var(--green)" }}>
            DATABASE_URL=postgresql://…?sslmode=require
          </div>
          <a
            className="tok-link"
            style={{ color: "var(--green)" }}
            href="https://neon.tech"
            target="_blank"
            rel="noreferrer"
          >
            → neon.tech (free Postgres)
          </a>
        </div>

        <div className="tok-c free">
          <div style={{ fontSize: 20, marginBottom: 8 }}>🤗</div>
          <div className="tok-name">HF_API_TOKEN — Pneumonia + TB X-ray</div>
          <div className="tok-desc">
            Real ViT chest X-ray for pneumonia (~30k free requests/month). Optional TB CXR model.
          </div>
          <div className="tok-env" style={{ color: "var(--green)" }}>
            HF_API_TOKEN=hf_…
          </div>
          <a
            className="tok-link"
            style={{ color: "var(--green)" }}
            href="https://huggingface.co/settings/tokens"
            target="_blank"
            rel="noreferrer"
          >
            → huggingface.co/settings/tokens
          </a>
        </div>

        <div className="tok-c free">
          <div style={{ fontSize: 20, marginBottom: 8 }}>⚡</div>
          <div className="tok-name">GROQ_API_KEY — Patient Chat (pehle yeh)</div>
          <div className="tok-desc">
            Chat answers: Groq first, phir Gemini fallback. Har sawal pehle Wikipedia se context.
          </div>
          <div className="tok-env" style={{ color: "var(--gold)" }}>
            GROQ_API_KEY=gsk_…
          </div>
          <a
            className="tok-link"
            style={{ color: "var(--gold)" }}
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
          >
            → console.groq.com/keys
          </a>
        </div>

        <div className="tok-c free">
          <div style={{ fontSize: 20, marginBottom: 8 }}>🌊</div>
          <div className="tok-name">GEMINI_API_KEY — Chat + embeddings</div>
          <div className="tok-desc">Groq fail/off ho to Gemini use hota hai. Embeddings bhi ho sakti hain.</div>
          <div className="tok-env" style={{ color: "var(--acc)" }}>
            GEMINI_API_KEY=AIza…
          </div>
          <a
            className="tok-link"
            style={{ color: "var(--acc)" }}
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
          >
            → aistudio.google.com/apikey
          </a>
        </div>

        <div className="tok-c local">
          <div style={{ fontSize: 20, marginBottom: 8 }}>🔬</div>
          <div className="tok-name">Imaging sklearn — token nahi</div>
          <div className="tok-desc">
            10 imaging diseases: <code>npm run train:imaging:setup</code> then{" "}
            <code>npm run train:imaging:all</code>. Sirf Python + disk space.
          </div>
          <div className="tok-env" style={{ color: "var(--violet)" }}>
            IMAGING_ML_PYTHON=python
          </div>
        </div>

        <div className="tok-c local">
          <div style={{ fontSize: 20, marginBottom: 8 }}>🔧</div>
          <div className="tok-name">DISEASE_ML_URL — optional Flask</div>
          <div className="tok-desc">PDF corpus train/predict sidecar. Imaging sklearn alag pipeline hai.</div>
          <div className="tok-env" style={{ color: "var(--violet)" }}>
            DISEASE_ML_URL=http://localhost:5001
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: "var(--font-display), serif",
          fontSize: 17,
          fontWeight: 700,
          color: "var(--txt)",
          marginBottom: 14
        }}
      >
        Quick priority
      </div>
      <div className="card" style={{ marginBottom: 20, fontSize: 12.5, color: "var(--txt2)", lineHeight: 1.65 }}>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            <strong style={{ color: "var(--txt)" }}>Minimum demo:</strong> kuch bhi optional — clinical formulas +
            imaging stub chalenge.
          </li>
          <li>
            <strong style={{ color: "var(--txt)" }}>Chat + history:</strong>{" "}
            <code>DATABASE_URL</code> + <code>GROQ_API_KEY</code> (preferred), optional <code>GEMINI_API_KEY</code>.
          </li>
          <li>
            <strong style={{ color: "var(--txt)" }}>Real pneumonia X-ray:</strong> <code>HF_API_TOKEN</code>.
          </li>
          <li>
            <strong style={{ color: "var(--txt)" }}>10 imaging uploads:</strong>{" "}
            <code>npm run train:imaging:all</code> (no API key).
          </li>
        </ol>
        <p style={{ margin: "12px 0 0" }}>
          Standalone tester UI: backend chalao (<code>npm run dev</code>) phir{" "}
          <a href="http://127.0.0.1:3333/tester" style={{ color: "var(--acc)" }}>
            http://127.0.0.1:3333/tester
          </a>
        </p>
      </div>
    </>
  );
}
