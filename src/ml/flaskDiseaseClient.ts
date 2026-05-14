/**
 * HTTP client for the Flask disease corpus ML sidecar (see ml/flask_disease/).
 */

function baseUrl(): string {
  return (process.env.DISEASE_ML_URL ?? "").trim().replace(/\/$/, "");
}

function secret(): string {
  return (process.env.DISEASE_ML_SECRET ?? "").trim();
}

export function isDiseaseMlEnabled(): boolean {
  return baseUrl().length > 0;
}

function authHeaders(): Record<string, string> {
  const s = secret();
  if (!s) return {};
  return { "X-Disease-Ml-Key": s };
}

export type CorpusIngestFile = {
  filename: string;
  mimeType: string;
  dataBase64: string;
  trainingLabel?: 0 | 1;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function diseaseCorpusIngest(
  diseaseSlug: string,
  opts: {
    functionality?: string;
    files: CorpusIngestFile[];
    /** Applied to every file when set (Flask form default). */
    trainingLabel?: 0 | 1;
  }
): Promise<unknown> {
  const b = baseUrl();
  const functionality = opts.functionality?.trim() || "educational_triage_text";
  const form = new FormData();
  form.set("functionality", functionality);
  if (opts.trainingLabel !== undefined) {
    form.set("trainingLabel", String(opts.trainingLabel));
  }
  for (const f of opts.files) {
    const buf = Buffer.from(f.dataBase64, "base64");
    const blob = new Blob([buf], { type: f.mimeType || "application/octet-stream" });
    form.append("file", blob, f.filename);
  }
  const res = await fetch(`${b}/v1/diseases/${encodeURIComponent(diseaseSlug)}/assets`, {
    method: "POST",
    headers: authHeaders(),
    body: form
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(
      typeof (body as { error?: string })?.error === "string"
        ? (body as { error: string }).error
        : `disease ML ingest HTTP ${res.status}`
    );
  }
  return body;
}

export async function diseaseCorpusTrain(
  diseaseSlug: string,
  body: {
    functionality?: string;
    formulaKey?: string;
    hyperparams?: Record<string, unknown>;
  }
): Promise<unknown> {
  const b = baseUrl();
  const res = await fetch(`${b}/v1/diseases/${encodeURIComponent(diseaseSlug)}/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      functionality: body.functionality ?? "educational_triage_text",
      formulaKey: body.formulaKey,
      hyperparams: body.hyperparams
    })
  });
  const out = await readJson(res);
  if (!res.ok) {
    throw new Error(
      typeof (out as { error?: string })?.error === "string"
        ? (out as { error: string }).error
        : `disease ML train HTTP ${res.status}`
    );
  }
  return out;
}

export async function diseaseCorpusModels(
  diseaseSlug: string,
  functionality?: string
): Promise<unknown> {
  const b = baseUrl();
  const fn = functionality?.trim() || "educational_triage_text";
  const url = new URL(`${b}/v1/diseases/${encodeURIComponent(diseaseSlug)}/models`);
  url.searchParams.set("functionality", fn);
  const res = await fetch(url.toString(), { headers: authHeaders() });
  const out = await readJson(res);
  if (!res.ok) {
    throw new Error(`disease ML models HTTP ${res.status}`);
  }
  return out;
}

export async function diseaseCorpusPredict(
  diseaseSlug: string,
  body: { functionality?: string; text: string }
): Promise<unknown> {
  const b = baseUrl();
  const res = await fetch(`${b}/v1/diseases/${encodeURIComponent(diseaseSlug)}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      functionality: body.functionality ?? "educational_triage_text",
      text: body.text
    })
  });
  const out = await readJson(res);
  if (!res.ok) {
    throw new Error(
      typeof (out as { error?: string })?.error === "string"
        ? (out as { error: string }).error
        : `disease ML predict HTTP ${res.status}`
    );
  }
  return out;
}
