import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bandToRiskLevel } from "../helpers.js";
import type { Prediction } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

export type ImagingSklearnMeta = {
  diseaseSlug: string;
  displayName?: string;
  trainedAt: string;
  methodology?: Record<string, unknown>;
  metrics?: {
    cvAuc?: number;
    cvFolds?: number;
    formulaKey?: string;
    testAccuracy?: number;
    testF1?: number;
    nSamples?: number;
    nPositive?: number;
    nNegative?: number;
  };
  artifactPath?: string;
};

export type ImagingSklearnPredictResult = {
  ok: boolean;
  slug?: string;
  positiveProbability?: number;
  predictedClass?: number;
  positiveLabel?: string;
  negativeLabel?: string;
  error?: string;
  meta?: ImagingSklearnMeta;
};

function pipelinePath(slug: string): string[] {
  return [
    path.join(REPO_ROOT, "ml", "artifacts", "imaging", slug, "pipeline.joblib"),
    path.join(process.cwd(), "ml", "artifacts", "imaging", slug, "pipeline.joblib")
  ];
}

function metaPath(slug: string): string[] {
  return [
    path.join(__dirname, "..", "models", "imaging", `${slug}-meta.json`),
    path.join(REPO_ROOT, "src", "diseases", "models", "imaging", `${slug}-meta.json`)
  ];
}

export function isImagingSklearnModelAvailable(slug: string): boolean {
  return pipelinePath(slug).some((p) => fs.existsSync(p));
}

export function loadImagingSklearnMeta(slug: string): ImagingSklearnMeta | null {
  for (const p of metaPath(slug)) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8")) as ImagingSklearnMeta;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function resolvePython(): string {
  return process.env.IMAGING_ML_PYTHON ?? process.env.TB_ML_PYTHON ?? process.env.PYTHON ?? "python";
}

function resolvePredictScript(): string {
  return path.join(REPO_ROOT, "ml", "scripts", "imaging_sklearn_predict.py");
}

export async function predictImagingSklearnImage(
  slug: string,
  imageBase64: string
): Promise<ImagingSklearnPredictResult> {
  if (!imageBase64 || imageBase64.length < 32) {
    return { ok: false, error: "Image too small or missing." };
  }
  if (!isImagingSklearnModelAvailable(slug)) {
    return {
      ok: false,
      error: `Imaging model for ${slug} not found. Run: npm run train:imaging:download && npm run train:imaging`
    };
  }

  const script = resolvePredictScript();
  const pipe = pipelinePath(slug).find((p) => fs.existsSync(p));
  const py = resolvePython();
  const clean = imageBase64.replace(/^data:[^;]+;base64,/, "");

  return new Promise((resolve) => {
    const proc = spawn(py, [script, "--slug", slug], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        IMAGING_SKLEARN_PIPELINE: pipe ?? ""
      },
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += String(d);
    });
    proc.stderr.on("data", (d) => {
      stderr += String(d);
    });
    proc.stdin.write(clean);
    proc.stdin.end();
    proc.on("error", (err) => {
      resolve({ ok: false, error: `Python spawn failed: ${err.message}` });
    });
    proc.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout.trim()) as ImagingSklearnPredictResult;
        if (!parsed.ok) {
          resolve(parsed);
          return;
        }
        resolve({
          ...parsed,
          meta: parsed.meta ?? loadImagingSklearnMeta(slug) ?? undefined
        });
      } catch {
        resolve({
          ok: false,
          error: `imaging predict failed (code ${code}): ${stderr || stdout}`.slice(0, 500)
        });
      }
    });
  });
}

export function imagingSklearnToPrediction(
  ml: ImagingSklearnPredictResult,
  positiveLabel: string,
  negativeLabel: string,
  rationaleBase: string
): Prediction | null {
  if (!ml.ok || ml.positiveProbability === undefined) return null;
  const p = ml.positiveProbability;
  const positive = p >= 0.5;
  const meta = ml.meta;
  const cvAuc = meta?.metrics?.cvAuc;

  return {
    classification: positive ? positiveLabel : negativeLabel,
    confidence: Math.min(1, Math.max(p, 1 - p)),
    riskLevel: bandToRiskLevel(p),
    signals: [
      { label: "Mode", value: "sklearn_imaging_ml" },
      { label: "Positive probability", value: Number(p.toFixed(4)) },
      { label: "Classifier", value: meta?.metrics?.formulaKey ?? "hog_*" },
      ...(cvAuc !== undefined
        ? [{ label: "Training CV AUC", value: Number(cvAuc.toFixed(3)) }]
        : []),
      ...(meta?.metrics?.nSamples !== undefined
        ? [{ label: "Training samples", value: meta.metrics.nSamples }]
        : [])
    ],
    rationale:
      `${rationaleBase} Sklearn classifier on HOG+histogram features ` +
      `(trained n=${meta?.metrics?.nSamples ?? "?"}, CV AUC≈${cvAuc?.toFixed(3) ?? "n/a"}). ` +
      `Educational only — not for clinical diagnosis.`
  };
}
