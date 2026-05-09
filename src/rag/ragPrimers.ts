/**
 * Synthetic, anonymised primer texts used only to “warm” each RAG namespace at seed time.
 * No real patients; illustrative language for demos and similarity search.
 */
export const ragPrimersBySlug: Record<string, string[]> = {
  "report-abnormal-labs-overview": [
    "Demo pattern: CMP shows creatinine trending from 1.0 to 1.4 mg/dL with stable eGFR 58; UA shows trace protein — consider dehydration vs early CKD and repeat BMP in ambulatory volume-replete state.",
    "Demo imaging note: CXR mentions mild prominence of interstitial markings bilaterally; correlate with spirometry and symptoms rather than interpreting as pneumonia without clinical fit.",
    "Demo labs: CBC with Hgb 11.8 g/dL, MCV 72 fL, ferritin low — suggests iron deficiency anemia workup trajectory (repeat CBC, ferritin, consider GI evaluation per guidelines).",
    "Demo lipid panel: LDL 165 mg/dL on no therapy; prioritize ASCVD risk discussion and lifestyle, consider statin per risk calculators in real practice.",
    "Demo CMP: ALT 92, AST 61, alkaline phosphatase normal — pattern consistent with hepatic enzyme elevation; differential includes medications and metabolic factors; repeating LFTs off hepatotoxic agents is a typical next step in demo workflows."
  ],
  "report-differential-diagnoses": [
    "Demo prompt: intermittent pleuritic chest pain + clear lungs on exam — differentials span musculoskeletal strain, pulmonary embolism (low pretest probability tools), pericarditis; report text should anchor pretest cues.",
    "Demo: subacute thyroid symptoms with suppressed TSH and elevated FT4 narrows toward hyperthyroidism causes (Graves vs thyroiditis) pending antibodies and uptake — illustrative only.",
    "Demo polyuria/polydipsia with random glucose 220 — diabetes mellitus enters differential; confirm with fasting glucose/A1c pattern in realistic pathways.",
    "Demo dyspnea on exertion in older adult — consider anemia, cardiac ischemia, COPD decompensation, PE; reconcile with spirometry, ECG, and risk factors from report narrative.",
    "Demo acute flank pain + microhematuria — nephrolithiasis vs urinary infection vs renal infarction; imaging and urinalysis context from report guides pretest framing in demos."
  ],
  "report-follow-up-plan": [
    "Demo follow-up: repeat HbA1c in 3 months after lifestyle initiation; reinforce nutrition referral and SMBG education if insulin starts — schedule template language only.",
    "Demo: colonoscopy overdue per age/risk — document outreach and bowel prep counselling; escalate if FIT positive in screening pathways (synthetic reminder).",
    "Demo oncology surveillance: imaging cadence q6 months ×2 years then annual per generic protocol language — verify against actual tumour guidelines in production systems.",
    "Demo cardiology referral if new LBBB on ECG combined with exertional symptoms — expedited stress testing or coronary evaluation per local pathways (demo phrasing).",
    "Demo: repeat BP checks twice weekly ×4 weeks after med change; goal guided by comorbidity profile — documentation snippet for counselling."
  ],
  "report-medication-safety-review": [
    "Demo meds: NSAID + chronic kidney disease — flag need to minimize nephrotoxic exposures and reassess indications; illustrative safety note.",
    "Demo warfarin with supratherapeutic INR 4.2 — temporary hold or dose adjustment and monitoring trajectory language for education.",
    "Demo QT-prolonging drug combination — suggest ECG vigilance when multiple contributors exist; not a prescribing directive.",
    "Demo renally cleared gabapentin with eGFR 35 — dosing adjustment reminders appear in stewardship references (illustrative).",
    "Demo ACE inhibitor initiation with K+ trending high — electrolyte surveillance and clinician review pattern (demo only)."
  ],
  "report-counseling-red-flags": [
    "Demo counseling: explain when to seek emergency care — crushing chest pressure, focal weakness, abrupt speech difficulty (generic red-flag education).",
    "Demo hydration guidance for gastroenteritis in adult without severe comorbidity — emphasize oral rehydration and return precautions for lethargy or blood in stool.",
    "Demo postpartum warning signs — fever, foul discharge, worsening pelvic pain cue urgent evaluation pathways (education snippet).",
    "Demo cellulitis return precautions — spreading erythema, systemic symptoms, hypotension cues escalation (generic).",
    "Demo oncology symptom triage — new focal neurologic deficits or sudden severe headache after therapy may require urgent imaging per institutional pathways (demo phrasing)."
  ]
};
