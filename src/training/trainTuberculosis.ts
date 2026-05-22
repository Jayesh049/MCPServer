/**
 * Train TB keyword lexicon from repo-root TB.pdf
 * Usage: npm run train:tb
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { buildTbLexiconFromPdfText } from "./tuberculosisLexiconBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

async function main() {
  const pdfPath = process.env.TB_PDF_PATH ?? path.join(REPO_ROOT, "TB.pdf");
  const raw = await fs.readFile(pdfPath);
  const b64 = raw.toString("base64");
  const { text } = await extractTextFromPdfBase64(b64);

  if (text.length < 500) {
    throw new Error(`TB.pdf extract too short (${text.length} chars). Check file at ${pdfPath}`);
  }

  const model = buildTbLexiconFromPdfText(text, { sourcePdf: path.basename(pdfPath) });

  const outJson = JSON.stringify(model, null, 2);
  const targets = [
    path.join(__dirname, "..", "diseases", "models", "tb-lexicon.json"),
    path.join(REPO_ROOT, "data", "tuberculosis", "tb-lexicon.json")
  ];

  for (const target of targets) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, outJson, "utf8");
    process.stdout.write(`Wrote ${target}\n`);
  }

  process.stdout.write(
    `\nTB lexicon: ${model.weightedTerms.length} terms from ${model.metrics?.pdfCharCount ?? 0} PDF chars.\n`
  );
  process.stdout.write(`Top terms: ${model.weightedTerms.slice(0, 8).map((t) => t.term).join(", ")}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
