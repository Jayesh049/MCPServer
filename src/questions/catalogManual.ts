/**
 * Manual demo question definitions (q2–q4) — paired with handlers in `src/answers/manualFlows.ts`.
 */
export type ManualQuestionId = "q2" | "q3" | "q4";

export type ManualQuestionEntry = {
  id: ManualQuestionId;
  title: string;
  prompt: string;
};

export const MANUAL_QUESTIONS: ManualQuestionEntry[] = [
  {
    id: "q2",
    title: "Home remedies and specialist doctors",
    prompt:
      "For this disease: Is care manageable at home with home remedies or lifestyle steps? Show remedies first, then top-level doctors (demo synthetic)."
  },
  {
    id: "q3",
    title: "Doctors by disease stage (1 / 2 / 3)",
    prompt:
      "For stage 1, stage 2, or stage 3: fetch and prioritise which doctors to engage — ranked order shifts by stage (demo synthetic)."
  },
  {
    id: "q4",
    title: "Health report → disease, cure, solution",
    prompt:
      "From a health report (PDF text): identify disease, outline supportive cure pathway (care plan excerpt), and specialist solution (doctors/meds — synthetic)."
  }
];
