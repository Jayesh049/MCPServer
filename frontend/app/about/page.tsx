import Link from "next/link";

export default function AboutPage() {
  return (
    <div>
      <section className="hero">
        <h1>About this tester</h1>
        <p>
          This UI is a manual test harness for the SHARP-on-MCP healthcare server. The
          server exposes 20 disease detection tools (12 imaging, 6 clinical, 2 signal),
          each running a deterministic <strong>detection → resolution → solution</strong>{" "}
          pipeline.
        </p>
      </section>

      <div className="panel">
        <h2>Important</h2>
        <ul className="list">
          <li>
            Use only <strong>synthetic / non-PHI</strong> data. The hackathon explicitly
            disqualifies submissions that include real Protected Health Information.
          </li>
          <li>
            For imaging models, the current scaffold uses a deterministic image-hash
            score so the UI can be tested manually. Real pretrained / self-trained
            models can be wired into the backend without changing this UI.
          </li>
          <li>
            All 20 tools are also exposed via the MCP server (Streamable HTTP at{" "}
            <code>/mcp</code>) and over stdio for local clients.
          </li>
        </ul>

        <p style={{ marginTop: 12 }}>
          <Link href="/" className="btn">
            ← Back to diseases
          </Link>
        </p>
      </div>
    </div>
  );
}
