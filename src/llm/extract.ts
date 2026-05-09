import type { NormalizedPatientFacts } from "../fhir/adapter.js";

export type ExtractedSignals = {
  missedFollowUps?: boolean;
  medicationSideEffect?: { medication: string; symptom: string }[];
  dietNonAdherence?: boolean;
  concerningLabs?: string[];
};

function includesAny(haystack: string, needles: string[]) {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

export function extractSignals(input: {
  facts: NormalizedPatientFacts;
  noteText?: string;
}): ExtractedSignals {
  const note = input.noteText ?? "";
  const signals: ExtractedSignals = {};

  if (note && includesAny(note, ["missed", "no show", "didn't come", "transportation"])) {
    signals.missedFollowUps = true;
  }

  if (note && includesAny(note, ["headache", "cough", "dizziness"])) {
    const meds = input.facts.medications.join(" | ").toLowerCase();
    const sideEffects: { medication: string; symptom: string }[] = [];
    if (meds.includes("lisinopril") && note.toLowerCase().includes("headache")) {
      sideEffects.push({ medication: "lisinopril", symptom: "headache" });
    }
    if (sideEffects.length > 0) {
      signals.medicationSideEffect = sideEffects;
    }
  }

  if (note && includesAny(note, ["diet", "inconsistent", "nonadherent", "non-adherent"])) {
    signals.dietNonAdherence = true;
  }

  const concerning: string[] = [];
  if (input.facts.labs.a1c?.value != null && input.facts.labs.a1c.value >= 8.5) {
    concerning.push(`A1c ${input.facts.labs.a1c.value}${input.facts.labs.a1c.unit}`);
  }
  if (input.facts.labs.ldl?.value != null && input.facts.labs.ldl.value >= 130) {
    concerning.push(`LDL ${input.facts.labs.ldl.value}${input.facts.labs.ldl.unit}`);
  }
  if (
    input.facts.labs.bp?.systolic != null &&
    input.facts.labs.bp?.diastolic != null &&
    (input.facts.labs.bp.systolic >= 140 || input.facts.labs.bp.diastolic >= 90)
  ) {
    concerning.push(
      `BP ${input.facts.labs.bp.systolic}/${input.facts.labs.bp.diastolic}${input.facts.labs.bp.unit}`
    );
  }
  if (concerning.length > 0) {
    signals.concerningLabs = concerning;
  }

  return signals;
}

