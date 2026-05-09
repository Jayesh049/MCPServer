import { PDFParse } from "pdf-parse";

export type PdfExtractResult = {
  pages: number;
  text: string;
};

export async function extractTextFromPdfBase64(
  pdfBase64: string,
  opts?: { maxBytes?: number; maxChars?: number }
): Promise<PdfExtractResult> {
  const maxBytes = opts?.maxBytes ?? 8 * 1024 * 1024; // 8 MB
  const maxChars = opts?.maxChars ?? 60_000;

  const buf = Buffer.from(pdfBase64, "base64");
  if (buf.byteLength === 0) throw new Error("Empty PDF payload.");
  if (buf.byteLength > maxBytes) {
    throw new Error(`PDF too large (${buf.byteLength} bytes). Limit is ${maxBytes} bytes.`);
  }

  const parser = new PDFParse({ data: buf } as any);
  try {
    const data = await parser.getText();
    const text = (data.text ?? "").replace(/\s+\n/g, "\n").trim();
    const clipped = text.length > maxChars ? text.slice(0, maxChars) : text;
    return { pages: Number((data as any).total ?? 0), text: clipped };
  } finally {
    await parser.destroy();
  }
}

