import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPatientFacts } from "../src/fhir/adapter.js";
import { extractSignals } from "../src/llm/extract.js";
import { computeCareGapTable } from "../src/domain/computeCareGaps.js";
import { CareGapTableSchema } from "../src/domain/careGaps.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Scenario = {
  fhirUrl: string;
  fhirToken?: string;
  patientId: string;
  noteText?: string;
};

const raw = await fs.readFile(path.join(__dirname, "scenario.json"), "utf8");
const scenario = JSON.parse(raw) as Scenario;

const facts = await getPatientFacts(
  { fhirUrl: scenario.fhirUrl, fhirToken: scenario.fhirToken, patientId: scenario.patientId },
  {}
);
const signals = extractSignals({ facts, noteText: scenario.noteText });
const table = computeCareGapTable({ patientId: scenario.patientId, facts, signals });
const validated = CareGapTableSchema.parse(table);

process.stdout.write(JSON.stringify({ facts, signals, table: validated }, null, 2) + "\n");

