export type RagQuestionCatalogEntry = {
  slug: string;
  title: string;
  description: string;
  /** One-line “doctor question” this RAG namespace is for (demo / synthetic only). */
  doctorQuestion: string;
};

/**
 * Five “resolution” angles: what a clinician typically needs answered to feel a **health report review is complete**
 * (synthetic RAG demo—not clinical decision support on its own).
 */
export const ragQuestionCatalog: RagQuestionCatalogEntry[] = [
  {
    slug: "report-abnormal-labs-overview",
    title: "RAG: Resolve report — synthesize labs & imaging",
    doctorQuestion:
      "Have I extracted every material abnormality, critical value, trend, or inconsistency in this report so I know what requires action, monitoring, or explanation before I consider the review done?",
    description:
      "Retrieval namespace for: integrating labs/imaging impressions into a coherent picture of what matters (demo snippets only)."
  },
  {
    slug: "report-differential-diagnoses",
    title: "RAG: Resolve report — working diagnosis & differentials",
    doctorQuestion:
      "Is my reasoning tight enough—working impression, leading differentials, and what in the report supports or argues against each—so the next steps I order are clinically justified, not left open-ended?",
    description:
      "Retrieval namespace for: diagnostic framing anchored to report text (education/demo; not a classifier)."
  },
  {
    slug: "report-follow-up-plan",
    title: "RAG: Resolve report — follow-up, tests, referrals",
    doctorQuestion:
      "Is the downstream plan explicit enough—specific tests, referrals, ownership, and timing—so nothing important is vague and follow-through is trackable?",
    description:
      "Retrieval namespace for: concrete follow-up and handoff language (demo)."
  },
  {
    slug: "report-medication-safety-review",
    title: "RAG: Resolve report — medications & safety",
    doctorQuestion:
      "Are medications, doses, renal/hepatic constraints, allergies, and interaction concerns reconciled against this report so the plan I finalize is safe to implement?",
    description:
      "Retrieval namespace for: med–lab–organ-function context (demo; always verify against formal drug references)."
  },
  {
    slug: "report-counseling-red-flags",
    title: "RAG: Resolve report — patient explanation & escalation",
    doctorQuestion:
      "Can I close the clinical loop—what to tell the patient, routine self-management, and when to escalate urgently—so understanding, adherence, and safety are accounted for?",
    description:
      "Retrieval namespace for: counseling summaries and escalation / red-flag phrasing (demo; not individualized advice)."
  }
];
