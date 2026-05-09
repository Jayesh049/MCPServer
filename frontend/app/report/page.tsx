import Link from "next/link";
import { ReportUploader } from "./uploader";

export default function ReportPage() {
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/" className="subtle">
          ← All diseases
        </Link>
      </div>
      <section className="hero">
        <h1>Upload a patient report (PDF)</h1>
        <p>
          This is a <strong>local-only</strong> PDF-to-text extractor that detects likely
          known diseases via keyword matching, then shows a synthetic care plan.
          Use only <strong>synthetic / de-identified</strong> reports (no PHI).
        </p>
      </section>

      <ReportUploader />
    </div>
  );
}

