import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trainLogisticRegression } from "./logisticRegression.js";
import {
  DIABETES_FEATURE_NAMES,
  generateDiabetesSynthetic
} from "./diabetesSynthetic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const samples = generateDiabetesSynthetic({ size: 4000, seed: 42 });
  const positives = samples.filter((s) => s.label === 1).length;
  const negatives = samples.length - positives;
  process.stdout.write(
    `Synthetic dataset: ${samples.length} samples (positives=${positives}, negatives=${negatives}).\n`
  );

  const model = trainLogisticRegression(samples, DIABETES_FEATURE_NAMES, {
    learningRate: 0.05,
    epochs: 1500,
    holdoutFraction: 0.2,
    seed: 17
  });

  process.stdout.write(
    `Trained LR. trainAcc=${model.metrics.trainAccuracy.toFixed(3)} holdoutAcc=${model.metrics.holdoutAccuracy.toFixed(3)}\n`
  );

  // Try writing to both src and dist locations so the predictor can find it
  // whether running from source (tsx) or from compiled dist.
  const out = JSON.stringify(model, null, 2);
  const candidates = [
    path.join(__dirname, "..", "diseases", "models", "diabetes-lr.json"),
    path.join(process.cwd(), "src", "diseases", "models", "diabetes-lr.json")
  ];

  for (const target of candidates) {
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, out);
      process.stdout.write(`Wrote model: ${target}\n`);
    } catch (e) {
      process.stderr.write(
        `Skipping write to ${target}: ${e instanceof Error ? e.message : String(e)}\n`
      );
    }
  }
}

main().catch((e) => {
  process.stderr.write(`Training failed: ${e?.stack ?? e}\n`);
  process.exit(1);
});
