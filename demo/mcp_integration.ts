import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type Scenario = {
  fhirUrl: string;
  fhirToken?: string;
  patientId: string;
  noteText?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raw = await fs.readFile(path.join(__dirname, "scenario.json"), "utf8");
const scenario = JSON.parse(raw) as Scenario;

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  cwd: path.join(__dirname, "..")
});

const client = new Client(
  { name: "local-integration-client", version: "0.1.0" },
  { capabilities: {} }
);

await client.connect(transport);

const tools = await client.listTools();
process.stdout.write(`Tools discovered: ${tools.tools.map((t) => t.name).join(", ")}\n`);

const meta = {
  fhirUrl: scenario.fhirUrl,
  fhirToken: scenario.fhirToken,
  patientId: scenario.patientId
};

const step1 = await client.callTool({
  name: "identify_care_gaps",
  arguments: { noteText: scenario.noteText },
  _meta: meta
});

function firstText(result: unknown): string {
  const r: any = result;
  const c = r?.content;
  if (Array.isArray(c) && c[0] && c[0].type === "text") return String(c[0].text);
  return "{}";
}

const step1Text = firstText(step1);
const step1Obj = JSON.parse(step1Text) as any;

const step2 = await client.callTool({
  name: "compute_risk_table",
  arguments: { facts: step1Obj.facts, extractedSignals: step1Obj.signals },
  _meta: meta
});
const step2Text = firstText(step2);
const table = JSON.parse(step2Text) as any;

const step3 = await client.callTool({
  name: "render_output_table",
  arguments: { table },
  _meta: meta
});
const step3Text = firstText(step3);

process.stdout.write(step3Text + "\n");

await transport.close();

