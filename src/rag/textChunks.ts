/** Split long text into overlapping chunks for embedding (simple paragraph-aware split). */
export function chunkText(raw: string, maxChars = 900): string[] {
  const t = raw.replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const paras = t.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    const s = buf.trim();
    if (s.length) out.push(s);
    buf = "";
  };
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > maxChars && buf.length > 0) {
      flush();
    }
    if (p.length > maxChars) {
      for (let i = 0; i < p.length; i += maxChars) {
        const slice = p.slice(i, i + maxChars).trim();
        if (slice.length) out.push(slice);
      }
      continue;
    }
    buf = buf.length ? `${buf}\n\n${p}` : p;
  }
  flush();
  return out;
}
