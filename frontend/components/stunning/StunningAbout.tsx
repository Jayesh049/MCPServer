import { StunningCredentials } from "./StunningCredentials";

export function StunningAbout() {
  return (
    <>
      <div className="ab-hero">
        <div className="ab-h">Where does every piece of data come from?</div>
        <div className="ab-p">
          Every data source is labeled throughout this interface — you always know exactly what you&apos;re seeing and
          why. This platform is for medical education only.
        </div>
      </div>

      <StunningCredentials />

      <div
        style={{
          fontFamily: "var(--font-display), serif",
          fontSize: 17,
          fontWeight: 700,
          color: "var(--txt)",
          marginBottom: 14
        }}
      >
        Data Sources
      </div>

      <div className="src-g">
        <div className="src-c">
          <div className="src-i">📖</div>
          <div className="src-n">Wikipedia RAG</div>
          <div className="src-d">
            Patient chat fetches Wikipedia medical articles, chunks + embeds via Gemini or local embeddings, stores in
            Postgres, retrieves by cosine similarity.
          </div>
          <span className="src-tag">Refreshed per question</span>
        </div>
        <div className="src-c">
          <div className="src-i">🧬</div>
          <div className="src-n">Disease Registry</div>
          <div className="src-d">
            20 diseases in registry. Clinical diseases use Framingham, CKD-EPI, NAFLD score, CHA₂DS₂-VASc — real
            validated scoring.
          </div>
          <span className="src-tag">Local · real models</span>
        </div>
        <div className="src-c">
          <div className="src-i">📄</div>
          <div className="src-n">PDF Extraction</div>
          <div className="src-d">
            PDFs parsed locally via pdf-parse. Text matched to weighted keyword dictionaries. No PHI leaves the server.
          </div>
          <span className="src-tag">Local · keyword weighted</span>
        </div>
        <div className="src-c">
          <div className="src-i">👨‍⚕️</div>
          <div className="src-n">Synthetic Care Plans</div>
          <div className="src-d">
            All doctors, hospitals, and medications are fictional. Generated with a date-seeded RNG — plan data rotates
            daily from dataPools.
          </div>
          <span className="src-tag">Synthetic · daily refresh</span>
        </div>
        <div className="src-c">
          <div className="src-i">🗄</div>
          <div className="src-n">Postgres / Neon</div>
          <div className="src-d">
            Q&A history, RAG embeddings, and healer fix-pattern cache all live in Postgres.
          </div>
          <span className="src-tag">Postgres · Neon</span>
        </div>
        <div className="src-c">
          <div className="src-i">🤖</div>
          <div className="src-n">LLM Providers</div>
          <div className="src-d">
            Chat uses whichever free or paid key you set: Anthropic Claude, Gemini Flash, Groq/Llama 70B, or OpenAI.
          </div>
          <span className="src-tag">Anthropic · Gemini · Groq</span>
        </div>
        <div className="src-c">
          <div className="src-i">🔧</div>
          <div className="src-n">Auto-Healer</div>
          <div className="src-d">
            Runtime errors from backend and frontend are parsed, sent to an LLM, patched, and cached in Postgres.
          </div>
          <span className="src-tag">LLM-powered</span>
        </div>
        <div className="src-c">
          <div className="src-i">🌐</div>
          <div className="src-n">MCP / FHIR Tools</div>
          <div className="src-d">
            When MCP transport is active the app exposes FHIR care-gap analysis tools via a synthetic adapter.
          </div>
          <span className="src-tag">MCP · Synthetic FHIR</span>
        </div>
      </div>

      <div className="disc" style={{ marginTop: 20 }}>
        <strong style={{ color: "var(--gold)" }}>Education only.</strong> All doctors, hospitals, medications, and risk
        scores are SYNTHETIC and fictional. No content constitutes medical advice. Always consult a qualified clinician.
      </div>
    </>
  );
}
