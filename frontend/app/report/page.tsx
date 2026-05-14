import Link from "next/link";
import { ReportUploader } from "./uploader";

export default function ReportPage() {
  return (
    <div>
      <div className="back-row">
        <Link href="/" className="subtle">
          ← All diseases
        </Link>
      </div>
      <div className="hero">
        <div className="hero-eyebrow">AI Analysis</div>
        <h1>
          Report <em>Analyzer</em>
        </h1>
        <p className="hero-sub">
          This is a <strong>local-only</strong> PDF-to-text extractor that detects likely known diseases via keyword matching,
          then shows a synthetic care plan. Use only <strong>synthetic / de-identified</strong> reports (no PHI).
        </p>
      </div>

      <ReportUploader />
    </div>
  );
}
