import type { FhirContext } from "../sharp/context.js";
import { loadSyntheticPatient } from "./mockStore.js";

export type NormalizedPatientFacts = {
  patientId: string;
  demographics: {
    gender?: string;
    birthDate?: string;
  };
  problems: string[];
  lastEncounterStart?: string;
  labs: {
    a1c?: { value: number; unit: string; effectiveDate: string };
    ldl?: { value: number; unit: string; effectiveDate: string };
    bp?: {
      systolic?: number;
      diastolic?: number;
      effectiveDate: string;
      unit: string;
    };
  };
  medications: string[];
};

function isMockFhirUrl(url: string) {
  return url.startsWith("mock://") || url.includes("synthetic") || url.includes("mock");
}

export async function getPatientFacts(
  ctx: FhirContext,
  opts: { dateRange?: { start?: string; end?: string } } = {}
): Promise<NormalizedPatientFacts> {
  if (!ctx.patientId) {
    throw new Error("Missing patientId in FHIR context for patient-level facts.");
  }

  if (!isMockFhirUrl(ctx.fhirUrl)) {
    // Demo-safe behavior: we don't call out to unknown endpoints by default.
    throw new Error(
      `This demo server only supports synthetic/mock FHIR URLs. Received: ${ctx.fhirUrl}`
    );
  }

  const data = await loadSyntheticPatient(ctx.patientId);

  // These are intentionally minimal, deterministic normalizations for the hackathon demo.
  const patient = data.patient as any;
  const problems =
    (data.conditions as any)?.entry?.map((e: any) => e?.resource?.code?.text).filter(Boolean) ??
    [];

  const meds =
    (data.meds as any)?.entry
      ?.map((e: any) => e?.resource?.medicationCodeableConcept?.text)
      .filter(Boolean) ?? [];

  const encounters = (data.encounters as any)?.entry?.map((e: any) => e?.resource) ?? [];
  const lastEncounterStart =
    encounters
      .map((e: any) => e?.period?.start)
      .filter(Boolean)
      .sort()
      .at(-1) ?? undefined;

  const obs = (data.observations as any)?.entry?.map((e: any) => e?.resource) ?? [];

  const a1cObs = obs
    .filter((o: any) => String(o?.code?.text ?? "").toLowerCase().includes("a1c"))
    .sort((a: any, b: any) => String(a?.effectiveDateTime ?? "").localeCompare(String(b?.effectiveDateTime ?? "")))
    .at(-1);

  const ldlObs = obs
    .filter((o: any) => String(o?.code?.text ?? "").toLowerCase().includes("ldl"))
    .sort((a: any, b: any) => String(a?.effectiveDateTime ?? "").localeCompare(String(b?.effectiveDateTime ?? "")))
    .at(-1);

  const bpObs = obs
    .filter((o: any) => String(o?.code?.text ?? "").toLowerCase().includes("blood pressure"))
    .sort((a: any, b: any) => String(a?.effectiveDateTime ?? "").localeCompare(String(b?.effectiveDateTime ?? "")))
    .at(-1);

  const systolic = bpObs?.component?.find((c: any) =>
    String(c?.code?.text ?? "").toLowerCase().includes("systolic")
  )?.valueQuantity?.value;
  const diastolic = bpObs?.component?.find((c: any) =>
    String(c?.code?.text ?? "").toLowerCase().includes("diastolic")
  )?.valueQuantity?.value;

  return {
    patientId: ctx.patientId,
    demographics: {
      gender: patient?.gender,
      birthDate: patient?.birthDate
    },
    problems,
    lastEncounterStart,
    labs: {
      a1c: a1cObs?.valueQuantity
        ? {
            value: Number(a1cObs.valueQuantity.value),
            unit: String(a1cObs.valueQuantity.unit ?? "%"),
            effectiveDate: String(a1cObs.effectiveDateTime)
          }
        : undefined,
      ldl: ldlObs?.valueQuantity
        ? {
            value: Number(ldlObs.valueQuantity.value),
            unit: String(ldlObs.valueQuantity.unit ?? "mg/dL"),
            effectiveDate: String(ldlObs.effectiveDateTime)
          }
        : undefined,
      bp: bpObs
        ? {
            systolic: systolic != null ? Number(systolic) : undefined,
            diastolic: diastolic != null ? Number(diastolic) : undefined,
            effectiveDate: String(bpObs.effectiveDateTime),
            unit: "mmHg"
          }
        : undefined
    },
    medications: meds
  };
}

