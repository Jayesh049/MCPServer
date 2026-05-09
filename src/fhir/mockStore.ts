import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readJsonFixture(filename: string): Promise<unknown> {
  const candidatePaths = [
    // When fixtures are copied next to compiled JS (recommended for deployment)
    path.join(__dirname, "fixtures", filename),
    // When running from source (tsx) or in environments that ship `src/`
    path.join(process.cwd(), "src", "fhir", "fixtures", filename)
  ];

  let lastError: unknown;
  for (const p of candidatePaths) {
    try {
      const raw = await fs.readFile(p, "utf8");
      return JSON.parse(raw) as unknown;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to load fixture JSON.");
}

export async function loadSyntheticPatient(patientId: string) {
  if (patientId !== "p001") {
    throw new Error(`Unknown synthetic patientId: ${patientId}`);
  }

  const [patient, conditions, observations, encounters, meds] = await Promise.all([
    readJsonFixture("patient-p001.json"),
    readJsonFixture("conditions-p001.json"),
    readJsonFixture("observations-p001.json"),
    readJsonFixture("encounters-p001.json"),
    readJsonFixture("medicationrequests-p001.json")
  ]);

  return { patient, conditions, observations, encounters, meds };
}

