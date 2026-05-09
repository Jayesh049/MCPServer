import { tools } from "./tools.js";
import { requireFhirContext, SharpContextError } from "../sharp/context.js";
import { getPatientFacts } from "../fhir/adapter.js";
import { extractSignals } from "../llm/extract.js";
import { computeCareGapTable } from "../domain/computeCareGaps.js";
import { CareGapTableSchema } from "../domain/careGaps.js";
import { runDiseasePipeline } from "../diseases/registry.js";
import { buildCarePlan } from "../care/carePlan.js";
import { extractTextFromPdfBase64 } from "../report/pdfText.js";
import { analyzeReportText } from "../report/analyzeReport.js";
import { invokeRagQuestion } from "../rag/invokeQuestion.js";

export type ToolCallInput = {
  toolName: string;
  toolArguments: unknown;
  meta: unknown;
};

export async function handleToolCall(input: ToolCallInput) {
  const tool = tools.find((t) => t.name === input.toolName);
  if (!tool) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Unknown tool: ${input.toolName}`
        }
      ]
    };
  }

  let fhirContext: ReturnType<typeof requireFhirContext> | undefined;
  if (tool.requiresFhirContext !== false) {
    try {
      fhirContext = requireFhirContext(input.meta);
    } catch (e) {
      const message =
        e instanceof SharpContextError ? e.message : "Missing required FHIR context.";
      return {
        isError: true,
        content: [{ type: "text", text: message }]
      };
    }
  }

  const args = tool.inputZod.parse(input.toolArguments ?? {});

  try {
    if (tool.domain === "rag-question" && tool.ragSlug) {
      const result = await invokeRagQuestion(tool.ragSlug, args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }

    // ---------- Care-gap tools ----------
    if (input.toolName === "get_patient_facts") {
      const facts = await getPatientFacts(fhirContext!, args as any);
      return {
        content: [{ type: "text", text: JSON.stringify(facts, null, 2) }]
      };
    }

    if (input.toolName === "identify_care_gaps") {
      const facts = await getPatientFacts(fhirContext!);
      const signals = extractSignals({ facts, noteText: (args as any).noteText });
      return {
        content: [{ type: "text", text: JSON.stringify({ facts, signals }, null, 2) }]
      };
    }

    if (input.toolName === "compute_risk_table") {
      const { facts, extractedSignals } = args as any;
      const table = computeCareGapTable({
        patientId: fhirContext!.patientId ?? "unknown",
        facts,
        signals: extractedSignals
      });
      return { content: [{ type: "text", text: JSON.stringify(table, null, 2) }] };
    }

    if (input.toolName === "render_output_table") {
      const { table } = args as any;
      const validated = CareGapTableSchema.parse(table);
      return { content: [{ type: "text", text: JSON.stringify(validated, null, 2) }] };
    }

    // ---------- Disease tools ----------
    if (tool.domain === "disease" && tool.diseaseSlug) {
      const result = await runDiseasePipeline(tool.diseaseSlug, args as any);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }

    // ---------- Care plan tool ----------
    if (input.toolName === "care_plan_for_disease") {
      const { diseaseSlug } = args as { diseaseSlug: string };
      const plan = buildCarePlan(diseaseSlug);
      return {
        content: [{ type: "text", text: JSON.stringify(plan, null, 2) }]
      };
    }

    // ---------- Report analysis tool ----------
    if (input.toolName === "analyze_patient_report_pdf") {
      const { pdfBase64, pdfText } = args as { pdfBase64?: string; pdfText?: string };
      if (pdfText && String(pdfText).trim().length > 0) {
        const analysis = analyzeReportText(String(pdfText));
        return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
      }
      if (!pdfBase64) {
        return {
          isError: true,
          content: [{ type: "text", text: "Missing pdfBase64 (or pdfText)." }]
        };
      }
      const extracted = await extractTextFromPdfBase64(String(pdfBase64));
      const analysis = analyzeReportText(extracted.text, extracted.pages);
      return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
    }

    return {
      isError: true,
      content: [{ type: "text", text: `Tool not implemented: ${input.toolName}` }]
    };
  } catch (e: any) {
    return {
      isError: true,
      content: [{ type: "text", text: e?.message ? String(e.message) : "Tool failed." }]
    };
  }
}
