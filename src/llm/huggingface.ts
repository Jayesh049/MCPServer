export type HFClassificationItem = {
  label: string;
  score: number;
};

export type HFClassifyResult = {
  modelId: string;
  predictions: HFClassificationItem[];
};

export type HFConfig = {
  apiToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

const DEFAULT_BASE_URL = "https://api-inference.huggingface.co/models";

export class HuggingFaceUnavailableError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export function getHFConfig(): HFConfig {
  return {
    apiToken: process.env.HF_API_TOKEN,
    baseUrl: process.env.HF_BASE_URL ?? DEFAULT_BASE_URL,
    timeoutMs: Number(process.env.HF_TIMEOUT_MS ?? 25000)
  };
}

export function isHFConfigured(): boolean {
  return Boolean(getHFConfig().apiToken);
}

export async function classifyImageWithHF(
  modelId: string,
  imageBase64: string,
  imageMimeType: string | undefined,
  cfg: HFConfig = getHFConfig()
): Promise<HFClassifyResult> {
  if (!cfg.apiToken) {
    throw new HuggingFaceUnavailableError(
      "HuggingFace API not configured (HF_API_TOKEN missing)."
    );
  }

  const url = `${cfg.baseUrl ?? DEFAULT_BASE_URL}/${modelId}`;
  const buf = Buffer.from(imageBase64, "base64");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 25000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        "Content-Type": imageMimeType || "application/octet-stream"
      },
      body: buf,
      signal: controller.signal
    });

    if (!res.ok) {
      throw new HuggingFaceUnavailableError(
        `HuggingFace request failed: ${res.status} ${res.statusText}`,
        res.status
      );
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new HuggingFaceUnavailableError(
        "Unexpected HuggingFace response (expected an array of {label,score})."
      );
    }

    const predictions: HFClassificationItem[] = (data as any[])
      .filter((d) => d && typeof d.label === "string" && typeof d.score === "number")
      .map((d) => ({ label: String(d.label), score: Number(d.score) }))
      .sort((a, b) => b.score - a.score);

    if (predictions.length === 0) {
      throw new HuggingFaceUnavailableError(
        "HuggingFace returned no usable predictions."
      );
    }

    return { modelId, predictions };
  } finally {
    clearTimeout(timer);
  }
}
