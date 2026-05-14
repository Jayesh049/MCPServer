import type { DynamicWebRagResult } from "../rag/dynamicWebRag.js";

const JARGON: Record<string, string> = {
  hypertension: "high blood pressure",
  hyperglycemia: "high blood sugar",
  hypoglycemia: "low blood sugar",
  myocardial: "heart",
  infarction: "heart attack",
  neoplasm: "growth or tumor",
  malignancy: "cancer",
  edema: "swelling",
  dyspnea: "shortness of breath",
  pruritus: "itching",
  asymptomatic: "no symptoms",
  etiology: "cause",
  idiopathic: "unknown cause",
  acute: "sudden",
  chronic: "long-lasting",
  benign: "not cancer",
  malignant: "cancer",
  lesion: "spot or area",
  modality: "type of test",
  radiograph: "X-ray",
  tomography: "CT scan"
};

function applySimpleWords(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(JARGON)) {
    const re = new RegExp(`\\b${k}\\b`, "gi");
    out = out.replace(re, v);
  }
  return out;
}

/** Split into shorter lines for easier reading (no true simplification beyond length). */
function softenParagraphs(text: string, maxSentenceChars = 140): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const p of parts) {
    if (p.length <= maxSentenceChars) {
      lines.push(p.trim());
      continue;
    }
    const chunks = p.match(/.{1,120}(\s|$)/g) ?? [p];
    for (const c of chunks) lines.push(c.trim());
  }
  return lines.join("\n");
}

export type SimplePatientInput = {
  rag: DynamicWebRagResult;
  requestedLanguage: string;
  hasPdfExcerpt: boolean;
  hasImageAttachment: boolean;
};

/**
 * Build a fixed-structure plain-English explanation from RAG only (no external LLM).
 */
export function buildSimplePatientPlain(input: SimplePatientInput): string {
  const { rag, requestedLanguage, hasPdfExcerpt, hasImageAttachment } = input;
  const top = rag.topMatches.slice(0, 2).map((m) => m.content.trim());
  const preview = applySimpleWords(rag.answerPreview.trim());

  const lines: string[] = [];
  lines.push("Here is a simple summary in plain English.");
  lines.push("");
  lines.push(`You picked language or region: "${requestedLanguage}".`);
  lines.push(
    "This demo only writes in English. Ask a family member, friend, or health worker to translate if you need another language."
  );
  lines.push("");

  if (hasImageAttachment) {
    lines.push("About your image:");
    lines.push(
      "We received an image file. This demo cannot read pictures. If the image matters, please describe it in words or upload a PDF with text."
    );
    lines.push("");
  }

  if (hasPdfExcerpt) {
    lines.push("About your document:");
    lines.push("We used text taken from your PDF together with your question.");
    lines.push("");
  }

  lines.push("What Wikipedia-style notes suggest (general facts, not about you personally):");
  lines.push("");
  if (top.length === 0) {
    lines.push(softenParagraphs(applySimpleWords(preview || "No short notes were found. Try a clearer question.")));
  } else {
    for (let i = 0; i < top.length; i++) {
      lines.push(`• Point ${i + 1}: ${softenParagraphs(applySimpleWords(top[i]!.slice(0, 900)))}`);
      lines.push("");
    }
    if (preview && preview.length > 200) {
      lines.push("Extra short lines from the best matches:");
      lines.push(softenParagraphs(preview.slice(0, 1500)));
    }
  }

  lines.push("");
  lines.push("What this might mean:");
  lines.push(
    "• These lines are general background from open sources. They are not a diagnosis and not a treatment plan for you."
  );
  lines.push("");
  lines.push("What to do next (general):");
  lines.push("• If you feel very unwell, seek urgent care or emergency services in your area.");
  lines.push("• For ongoing questions, talk with a licensed clinician who knows you.");
  lines.push("");
  lines.push("Important:");
  lines.push(
    "• This software is a demo. It uses synthetic or public text patterns. Do not rely on it for medical decisions."
  );

  return lines.join("\n");
}
