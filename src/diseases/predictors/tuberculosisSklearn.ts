import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bandToRiskLevel } from "../helpers.js";
import type { Prediction } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

export type TbSklearnMeta = {
  diseaseSlug: string;
  trainedAt: string;
  sourcePdfs: string[];
  sourceCitation: string;
  methodology: Record<string, unknown>;
  metrics: {
    cvAuc?: number;
    cvFolds?: number;
    selectedClassifier?: string;
    formulaKey?: string;
    trainAccuracy?: number;
    trainF1?: number;
    nSamples?: number;
  };
  artifactPath?: string;
};

export type TbSklearnPredictResult = {
  ok: boolean;
  tbProbability?: number;
  predictedClass?: number;
  error?: string;
  meta?: TbSklearnMeta;
};

function pipelinePaths(): string[] {
  return [
    path.join(REPO_ROOT, "ml", "artifacts", "tuberculosis", "tb2_sklearn_pipeline.joblib"),
    path.join(process.cwd(), "ml", "artifacts", "tuberculosis", "tb2_sklearn_pipeline.joblib")
  ];
}

function metaPaths(): string[] {
  return [
    path.join(__dirname, "..", "models", "tb2-sklearn-meta.json"),
    path.join(REPO_ROOT, "src", "diseases", "models", "tb2-sklearn-meta.json")
  ];
}

export function isTbSklearnModelAvailable(): boolean {
  return pipelinePaths().some((p) => fs.existsSync(p));
}

export function loadTbSklearnMeta(): TbSklearnMeta | null {
  for (const p of metaPaths()) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf8")) as TbSklearnMeta;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function resolvePython(): string {
  return process.env.TB_ML_PYTHON ?? process.env.PYTHON ?? "python";
}

function resolvePredictScript(): string {
  return path.join(REPO_ROOT, "ml", "scripts", "tb_sklearn_predict.py");
}

export async function predictTbSklearnText(text: string): Promise<TbSklearnPredictResult> {
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    return { ok: false, error: "Text too short for sklearn TB model (min 20 chars)." };
  }
  if (!isTbSklearnModelAvailable()) {
    return {
      ok: false,
      error: "TB sklearn model not found. Run: npm run train:tb2-ml"
    };
  }

  const script = resolvePredictScript();
  const pipe = pipelinePaths().find((p) => fs.existsSync(p));
  const py = resolvePython();

  return new Promise((resolve) => {
    const proc = spawn(py, [script, trimmed], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        TB_SKLEARN_PIPELINE: pipe ?? ""
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
    proc.on("error", (err) => {
      resolve({ ok: false, error: `Python spawn failed: ${err.message}` });
    });
    proc.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout.trim()) as TbSklearnPredictResult;
        if (!parsed.ok) {
          resolve(parsed);
          return;
        }
        resolve({
          ...parsed,
          meta: parsed.meta ?? loadTbSklearnMeta() ?? undefined
        });
      } catch {
        resolve({
          ok: false,
          error: `sklearn predict failed (code ${code}): ${stderr || stdout}`.slice(0, 500)
        });
      }
    });
  });
}

export function tbSklearnToPrediction(
  ml: TbSklearnPredictResult,
  context: string
): Prediction | null {
  if (!ml.ok || ml.tbProbability === undefined) return null;
  const p = ml.tbProbability;
  const positive = p >= 0.5;
  const meta = ml.meta;
  const cvAuc = meta?.metrics?.cvAuc;

  return {
    classification: positive ? "tb_text_ml_positive" : "tb_text_ml_negative",
    confidence: Math.min(1, Math.max(p, 1 - p)),
    riskLevel: bandToRiskLevel(p),
    signals: [
      { label: "Mode", value: "sklearn_tb2_ml" },
      { label: "TB probability", value: Number(p.toFixed(4)) },
      { label: "Classifier", value: meta?.metrics?.formulaKey ?? "tfidf_*" },
      ...(cvAuc !== undefined ? [{ label: "Training CV AUC", value: Number(cvAuc.toFixed(3)) }] : [])
    ],
    rationale:
      `${context} Real sklearn classifier trained from TB2.pdf (anti-TB compound ML review) ` +
      `with TF-IDF features and ${meta?.metrics?.formulaKey ?? "LR/RF"} ` +
      `(CV AUC≈${cvAuc?.toFixed(3) ?? "n/a"}). Educational only — not clinical diagnosis.`
  };
}
