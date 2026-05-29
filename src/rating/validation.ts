import { prisma } from "../lib/prisma.js";

function boundedScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

type ValidateInput = {
  consultationId: string;
  doctorRatingId?: string;
  patientRatingId?: string;
  score: number;
  formAnswers: Record<string, unknown>;
};

/**
 * Basic heuristic automation:
 * - validates minimum consultation evidence (messages/transcript length)
 * - flags extreme mismatches between rating score and negative signals
 * Output still requires manual review for final truth decision.
 */
export async function runRatingValidation(input: ValidateInput) {
  const consult = await prisma.consultation.findUnique({
    where: { id: input.consultationId },
    include: {
      messages: { orderBy: { sentAt: "asc" } },
      callRecordings: { orderBy: { createdAt: "desc" }, take: 3 }
    }
  });
  if (!consult) throw new Error("Consultation not found for validation.");

  const totalMsgs = consult.messages.length;
  const textEvidence = consult.messages.map((m) => m.body).join("\n");
  const transcript = consult.callRecordings.map((r) => r.transcript || "").join("\n");
  const totalEvidenceChars = (textEvidence + transcript).trim().length;
  const negativeTerms = ["rude", "abuse", "late", "no response", "fraud", "cheat", "ignored"];
  const negativeHits = negativeTerms.reduce(
    (s, t) => s + ((textEvidence + " " + transcript).toLowerCase().match(new RegExp(t, "g"))?.length ?? 0),
    0
  );

  const flags: string[] = [];
  if (!consult.patientConsentedRecording || !consult.doctorConsentedRecording) {
    flags.push("missing_recording_consent");
  }
  if (totalMsgs < 3) flags.push("low_message_count");
  if (totalEvidenceChars < 120) flags.push("insufficient_evidence");
  if (input.score >= 9 && negativeHits > 0) flags.push("high_score_with_negative_signals");
  if (input.score <= 3 && negativeHits === 0 && totalEvidenceChars > 400) {
    flags.push("low_score_without_negative_signals");
  }
  if (!input.formAnswers || Object.keys(input.formAnswers).length < 10) {
    flags.push("incomplete_form_answers");
  }

  const base = 0.85;
  const confidence = boundedScore(base - flags.length * 0.12);
  const autoDecision = flags.length ? "FLAGGED" : "APPROVED";
  const evidenceSummary =
    `messages=${totalMsgs}; evidenceChars=${totalEvidenceChars}; callRecordings=${consult.callRecordings.length}; negativeHits=${negativeHits}`;

  const run = await prisma.ratingValidationRun.create({
    data: {
      doctorRatingId: input.doctorRatingId,
      patientRatingId: input.patientRatingId,
      confidence,
      flags,
      evidenceSummary,
      autoDecision
    }
  });

  return { run, autoDecision, confidence, flags, evidenceSummary };
}

