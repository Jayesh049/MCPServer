/**
 * Short, original educational blurbs **informed by** public sources (cited in `citations`).
 * Not copied text—paraphrased for RAG demo retrieval. Always verify at source for clinical use.
 *
 * Themes map to the five RAG slugs in `src/questions/catalog.ts`.
 */
export type WebCuratedChunk = {
  chunkId: string;
  slug:
    | "report-abnormal-labs-overview"
    | "report-differential-diagnoses"
    | "report-follow-up-plan"
    | "report-medication-safety-review"
    | "report-counseling-red-flags";
  text: string;
  citations: string[];
};

export const webCuratedChunks: WebCuratedChunk[] = [
  // --- Labs / reports (MedlinePlus-style themes on understanding results) ---
  {
    chunkId: "labs-context-history-v1",
    slug: "report-abnormal-labs-overview",
    citations: ["https://medlineplus.gov/labtests/howtounderstandyourlabresults.html"],
    text:
      "[Context: integrating labs] Interpreting a report should combine numeric results with history, exam, medications, diet, and how the sample was collected—wide “normal” ranges vary by age, sex, and method. A single isolated value rarely defines a diagnosis; trends and correlated tests usually matter more for clinical resolution."
  },
  {
    chunkId: "labs-terminology-v1",
    slug: "report-abnormal-labs-overview",
    citations: ["https://medlineplus.gov/labtests/howtounderstandyourlabresults.html"],
    text:
      "[Patient question: what do words on the report mean?] Many reports label results as within expected range versus flagged abnormal; unclear or equivocal wording often means repeat testing or a different modality is reasonable. Patients should ask what the test measures, whether preparation affected it, and what change would prompt earlier follow-up."
  },
  {
    chunkId: "labs-why-ordered-v1",
    slug: "report-abnormal-labs-overview",
    citations: ["https://medlineplus.gov/laboratorytests.html"],
    text:
      "[Clinician resolution: scope of testing] Laboratories support screening, diagnosis, therapeutic monitoring, and prognostication. When closing a chart, document which of these intents applies so follow-up cadence matches risk (e.g., monitoring glycaemic control differs from diagnosing an acute syndrome)."
  },
  // --- Differentials / working diagnosis (clinical reasoning education) ---
  {
    chunkId: "ddx-structure-findings-v1",
    slug: "report-differential-diagnoses",
    citations: [
      "https://bestpractice.bmj.com/topics/en-gb/301",
      "https://www.ahrq.gov/patient-safety/settings/hospital/diagnostic-error/index.html"
    ],
    text:
      "[Sharper clinician question] A defensible differential lists leading diagnoses conditioned on pre-test probability from history, tempo, demographics, and key examination features; each candidate should cite findings that argue for it and findings that argue against rivals. When two diagnoses overlap (e.g., similar cardiorespiratory syndromes), explicitly contrast discriminating clues before locking a plan."
  },
  {
    chunkId: "ddx-iterate-data-v1",
    slug: "report-differential-diagnoses",
    citations: ["https://medlineplus.gov/labtests/howtounderstandyourlabresults.html"],
    text:
      "[Working diagnosis versus open differentials] A working diagnosis is acceptable when probabilities are high enough to proceed safely—but the chart should note what additional data would change management (focused labs, imaging, monitoring). If ambiguity remains materially risky, widen the differential or accelerate rule-out strategies before discharge."
  },
  {
    chunkId: "ddx-hypothesis-exploration-v1",
    slug: "report-differential-diagnoses",
    citations: ["https://www.ahrq.gov/patient-safety/settings/hospital/diagnostic-error/index.html"],
    text:
      "[Diagnostic safety habit] Reducing harmful misses often means testing whether an alternative explanation better fits the timeline and objective findings. Document “if-then” branches: if the next test is negative, which diagnosis drops in likelihood and which rises; this makes handoffs auditable for both doctors and patients asking ‘what else could this be?’."
  },
  // --- Next steps: tests, referrals, meds, timing ---
  {
    chunkId: "plan-smart-next-steps-v1",
    slug: "report-follow-up-plan",
    citations: ["https://www.ahrq.gov/patient-safety/settings/hospital/teamstepps/index.html"],
    text:
      "[Patient & doctor: what happens next, by when?] A satisfying plan names the action (test, referral, medication change, education), the responsible party, the target date or window, and how results will be communicated. Vague ‘follow up if worse’ should be paired with concrete symptoms, channels, and backup options when access is uncertain."
  },
  {
    chunkId: "plan-closed-loop-v1",
    slug: "report-follow-up-plan",
    citations: ["https://www.who.int/teams/integrated-health-services/clinical-services-and-systems"],
    text:
      "[Closed-loop documentation] To consider a report ‘resolved’ operationally, record whether critical results were acknowledged, whether pending studies have an owner, and whether the patient knows how to obtain results. Many safety events trace to unclosed loops between primary, specialty, and laboratory services."
  },
  {
    chunkId: "plan-prioritization-v1",
    slug: "report-follow-up-plan",
    citations: ["https://www.nice.org.uk/guidance"],
    text:
      "[Prioritising when everything cannot be done at once] Rank follow-up by harm if delayed: rule-out life threats first, then reversible organ injury, then chronic disease optimisation. State explicit intervals (e.g., repeat labs in days versus weeks) so patients and covering clinicians can triage competing recommendations."
  },
  // --- Medication safety ---
  {
    chunkId: "meds-reconciliation-v1",
    slug: "report-medication-safety-review",
    citations: ["https://www.who.int/teams/medicines-alliance/medication-safety"],
    text:
      "[Reconciliation check] Compare home medications, newly prescribed drugs, and allergies against labs that affect clearance (renal/hepatic indices) and risks (electrolytes, coagulation). Satisfaction for prescriber and patient includes stating what to hold, what to substitute, and what monitoring interval follows a change."
  },
  {
    chunkId: "meds-communication-v1",
    slug: "report-medication-safety-review",
    citations: ["https://medlineplus.gov/ency/patientinstructions/000867.htm"],
    text:
      "[Patient-facing medication questions] Encourage patients to ask the drug’s purpose, major side effects, interactions with foods or OTC products, and what to do if a dose is missed; document teach-back when possible so safety instructions are verifiable, not assumed."
  },
  // --- When to call / emergency vs wait (NHS escalation themes, paraphrased) ---
  {
    chunkId: "triage-emergency-patterns-v1",
    slug: "report-counseling-red-flags",
    citations: ["https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999"],
    text:
      "[When to seek emergency care now] Teach patients that sudden severe symptoms such as crushing chest pain, signs of stroke, major bleeding or trauma, airway compromise, seizure, suspected anaphylaxis, or symptoms suggesting shock warrant immediate emergency activation per local protocols—not ‘wait until tomorrow.’"
  },
  {
    chunkId: "triage-urgent-not-emergency-v1",
    slug: "report-counseling-red-flags",
    citations: ["https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-use-111"],
    text:
      "[Unsure how urgent—what to advise] When problems are troublesome but unclear as life-threatening, direct patients to clinician telephone triage or urgent care pathways available in their system (often same-day advice), with instructions on what worsening signs would escalate to emergency care."
  },
  {
    chunkId: "triage-primary-routine-v1",
    slug: "report-counseling-red-flags",
    citations: ["https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services"],
    text:
      "[Routine versus urgent GP follow-up] Stable chronic issues, preventive planning, medication titration without alarming symptoms typically fit booked primary care—not emergency rooms. Satisfaction grows when expectations are explicit: what improves with self-care, what requires callback, and the window for reassessment."
  }
];
