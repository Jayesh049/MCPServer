import xlsx from "xlsx";

export type TabularExtractResult = {
  text: string;
};

function clip(text: string, maxChars: number): string {
  const t = text.trim();
  return t.length > maxChars ? t.slice(0, maxChars) : t;
}

export function extractTextFromXlsxBase64(
  xlsxBase64: string,
  opts?: { maxBytes?: number; maxChars?: number; maxSheets?: number }
): TabularExtractResult {
  const maxBytes = opts?.maxBytes ?? 6 * 1024 * 1024; // 6 MB
  const maxChars = opts?.maxChars ?? 60_000;
  const maxSheets = opts?.maxSheets ?? 10;

  const buf = Buffer.from(xlsxBase64, "base64");
  if (buf.byteLength === 0) throw new Error("Empty XLSX payload.");
  if (buf.byteLength > maxBytes) {
    throw new Error(`XLSX too large (${buf.byteLength} bytes). Limit is ${maxBytes} bytes.`);
  }

  const wb = xlsx.read(buf, { type: "buffer" });
  const names = (wb.SheetNames ?? []).slice(0, maxSheets);
  const parts: string[] = [];

  for (const name of names) {
    const sheet = wb.Sheets?.[name];
    if (!sheet) continue;
    const csv = xlsx.utils.sheet_to_csv(sheet, { blankrows: false });
    const trimmed = csv.trim();
    if (trimmed.length === 0) continue;
    parts.push(`--- Sheet: ${name} ---\n${trimmed}`);
  }

  const joined = parts.join("\n\n");
  if (!joined) throw new Error("No readable cells found in XLSX.");
  return { text: clip(joined, maxChars) };
}

export function extractTextFromCsvText(
  csvText: string,
  opts?: { maxChars?: number }
): TabularExtractResult {
  const maxChars = opts?.maxChars ?? 60_000;
  if (!csvText || csvText.trim().length === 0) throw new Error("Empty CSV text.");
  return { text: clip(csvText, maxChars) };
}

