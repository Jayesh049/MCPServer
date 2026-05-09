import type { Hospital } from "./types.js";

/**
 * Synthetic, fictional hospital list. NOT real institutions; do not use for clinical decisions.
 */
export const HOSPITAL_POOL: Hospital[] = [
  { name: "Aurora General Hospital", city: "Boston", country: "USA" },
  { name: "Banyan Tree Medical Center", city: "Bengaluru", country: "India" },
  { name: "Northwind Specialty Hospital", city: "Toronto", country: "Canada" },
  { name: "Lighthouse University Hospital", city: "London", country: "UK" },
  { name: "Cedarbrook Cancer Institute", city: "Seattle", country: "USA" },
  { name: "Riverstone Heart & Lung Center", city: "Sydney", country: "Australia" },
  { name: "Mountain View Memorial Hospital", city: "Denver", country: "USA" },
  { name: "Lotus Bay Multispecialty Hospital", city: "Singapore", country: "Singapore" },
  { name: "Greenfield Research Hospital", city: "Berlin", country: "Germany" },
  { name: "Sapphire Coast Medical College", city: "Mumbai", country: "India" }
];

export type DoctorSeed = {
  name: string;
  specialty: string;
  yearsOfExperience: number;
  bio: string;
};

/**
 * Synthetic, fictional doctor list. All names are made-up. NOT real practitioners.
 */
export const DOCTOR_POOL: DoctorSeed[] = [
  // Oncology
  { name: "Dr. Anika Verma",      specialty: "Medical Oncology",   yearsOfExperience: 18, bio: "Focus on solid tumors with an emphasis on shared decision-making and quality of life." },
  { name: "Dr. Marcus Hale",      specialty: "Thoracic Oncology",  yearsOfExperience: 22, bio: "Lung-cancer multidisciplinary clinic lead; trained in molecular profiling." },
  { name: "Dr. Yuki Tanaka",      specialty: "Radiation Oncology", yearsOfExperience: 14, bio: "Stereotactic body radiation for early-stage thoracic disease." },
  { name: "Dr. Priya Iyer",       specialty: "Surgical Oncology",  yearsOfExperience: 20, bio: "Minimally invasive thoracic surgery and breast oncology." },
  // Cardiology
  { name: "Dr. Liam O'Connor",    specialty: "Cardiology",         yearsOfExperience: 25, bio: "Preventive cardiology, heart failure, and structural disease." },
  { name: "Dr. Sara Khan",        specialty: "Interventional Cardiology", yearsOfExperience: 16, bio: "Catheter-based therapies, cardiac rehab champion." },
  // Endocrinology / Internal Medicine
  { name: "Dr. Elena Petrova",    specialty: "Endocrinology",      yearsOfExperience: 19, bio: "Type 2 diabetes, thyroid disease, lifestyle medicine." },
  { name: "Dr. Daniel Okafor",    specialty: "Internal Medicine",  yearsOfExperience: 12, bio: "Chronic disease management, HbA1c clinics, motivational interviewing." },
  // Pulmonology
  { name: "Dr. Rohan Mehta",      specialty: "Pulmonology",        yearsOfExperience: 15, bio: "Interstitial lung disease, COPD, sleep medicine." },
  { name: "Dr. Aiko Yamamoto",    specialty: "Pulmonology",        yearsOfExperience: 21, bio: "Tuberculosis programs and pulmonary rehabilitation." },
  // Neurology / Neuro-oncology
  { name: "Dr. Hannah Becker",    specialty: "Neurology",          yearsOfExperience: 17, bio: "Stroke, Parkinson's disease, and movement disorders." },
  { name: "Dr. Idris Ahmed",      specialty: "Neuro-oncology",     yearsOfExperience: 13, bio: "Glioma management, integrating immunotherapy trials." },
  // Nephrology / Hepatology
  { name: "Dr. Camila Reyes",     specialty: "Nephrology",         yearsOfExperience: 11, bio: "CKD risk reduction and home dialysis." },
  { name: "Dr. Theo Larsen",      specialty: "Hepatology",         yearsOfExperience: 16, bio: "Fatty liver disease and hepatitis follow-up clinics." },
  // Dermatology / Ophthalmology / Orthopedics
  { name: "Dr. Maya Singh",       specialty: "Dermatology",        yearsOfExperience: 10, bio: "Skin cancer screening and cosmetic dermatology." },
  { name: "Dr. Felix Weber",      specialty: "Ophthalmology",      yearsOfExperience: 23, bio: "Glaucoma, cataract, and diabetic retinopathy clinics." },
  { name: "Dr. Noor Hassan",      specialty: "Orthopedics",        yearsOfExperience: 14, bio: "Sports medicine, fracture care, and post-op rehab." },
  // Geriatrics / Psychiatry / Infectious disease
  { name: "Dr. Beatrice Lin",     specialty: "Geriatric Medicine", yearsOfExperience: 18, bio: "Dementia care, falls prevention, polypharmacy reviews." },
  { name: "Dr. Samir Choudhury",  specialty: "Psychiatry",         yearsOfExperience: 12, bio: "Mood disorders co-occurring with chronic disease." },
  { name: "Dr. Olivia Park",      specialty: "Infectious Disease", yearsOfExperience: 15, bio: "Respiratory infections and antimicrobial stewardship." }
];

export type MedicationTemplate = {
  name: string;
  doseOptions: string[];
  schedule: string;
  rationale: string;
  cautions?: string[];
};

/**
 * Per-disease medication templates. Each entry below is a CANDIDATE pool;
 * the builder picks dose variants and assigns them to doctors. None of these
 * are clinical recommendations - they are placeholder education content.
 */
export const MEDICATION_POOL: Record<string, MedicationTemplate[]> = {
  "lung-cancer": [
    { name: "Pembrolizumab",   doseOptions: ["200 mg IV"],            schedule: "every 3 weeks", rationale: "Anti-PD-1 immunotherapy for eligible non-small-cell lung cancer.", cautions: ["Immune-related adverse events"] },
    { name: "Cisplatin",       doseOptions: ["75 mg/m^2 IV"],         schedule: "day 1 of 21-day cycle", rationale: "Platinum chemotherapy backbone." },
    { name: "Pemetrexed",      doseOptions: ["500 mg/m^2 IV"],        schedule: "day 1 of 21-day cycle", rationale: "Antifolate chemotherapy for non-squamous NSCLC." },
    { name: "Osimertinib",     doseOptions: ["80 mg PO"],             schedule: "once daily", rationale: "EGFR-TKI for EGFR-mutant disease." },
    { name: "Crizotinib",      doseOptions: ["250 mg PO"],            schedule: "twice daily", rationale: "ALK/ROS1 targeted therapy." },
    { name: "Bevacizumab",     doseOptions: ["15 mg/kg IV"],          schedule: "every 3 weeks", rationale: "Anti-VEGF; used with chemo in non-squamous NSCLC." },
    { name: "Dexamethasone",   doseOptions: ["4 mg PO", "8 mg PO"],   schedule: "with chemo cycles", rationale: "Antiemetic and anti-edema premedication." },
    { name: "Ondansetron",     doseOptions: ["8 mg PO"],              schedule: "before chemo", rationale: "5-HT3 antagonist for nausea." },
    { name: "Filgrastim",      doseOptions: ["5 mcg/kg SC"],          schedule: "daily for 5-7 days post-chemo", rationale: "G-CSF for febrile neutropenia prevention." },
    { name: "Morphine ER",     doseOptions: ["15 mg PO", "30 mg PO"], schedule: "every 12 hours", rationale: "Cancer-related pain control.", cautions: ["Constipation","Sedation"] },
    { name: "Albuterol",       doseOptions: ["2 puffs"],              schedule: "every 4-6 hours PRN", rationale: "Bronchospasm and dyspnea relief." },
    { name: "Lorazepam",       doseOptions: ["0.5 mg PO"],            schedule: "every 8 hours PRN", rationale: "Anxiety and dyspnea-related distress." }
  ],
  "breast-cancer": [
    { name: "Tamoxifen",       doseOptions: ["20 mg PO"], schedule: "once daily", rationale: "ER+ adjuvant endocrine therapy." },
    { name: "Anastrozole",     doseOptions: ["1 mg PO"],  schedule: "once daily", rationale: "Aromatase inhibitor for postmenopausal ER+ disease." },
    { name: "Trastuzumab",     doseOptions: ["6 mg/kg IV"], schedule: "every 3 weeks", rationale: "HER2-targeted therapy." },
    { name: "Doxorubicin",     doseOptions: ["60 mg/m^2 IV"], schedule: "every 3 weeks", rationale: "Anthracycline chemo." },
    { name: "Cyclophosphamide",doseOptions: ["600 mg/m^2 IV"], schedule: "every 3 weeks", rationale: "Alkylating chemo." },
    { name: "Paclitaxel",      doseOptions: ["80 mg/m^2 IV"], schedule: "weekly", rationale: "Taxane chemo." },
    { name: "Letrozole",       doseOptions: ["2.5 mg PO"], schedule: "once daily", rationale: "Aromatase inhibitor." },
    { name: "Palbociclib",     doseOptions: ["125 mg PO"], schedule: "21 days on / 7 off", rationale: "CDK4/6 inhibitor for HR+/HER2- disease." },
    { name: "Denosumab",       doseOptions: ["120 mg SC"], schedule: "every 4 weeks", rationale: "Bone-metastasis support." },
    { name: "Ondansetron",     doseOptions: ["8 mg PO"],   schedule: "before chemo", rationale: "Antiemetic." },
    { name: "Dexamethasone",   doseOptions: ["4 mg PO"],   schedule: "with chemo cycles", rationale: "Antiemetic premedication." },
    { name: "Tramadol",        doseOptions: ["50 mg PO"],  schedule: "every 6 hours PRN", rationale: "Mild-to-moderate pain." }
  ],
  "diabetes": [
    { name: "Metformin",       doseOptions: ["500 mg PO", "1000 mg PO"], schedule: "twice daily", rationale: "First-line therapy for type 2 diabetes." },
    { name: "Glipizide",       doseOptions: ["5 mg PO"],  schedule: "once daily", rationale: "Sulfonylurea adjunct.", cautions: ["Hypoglycemia"] },
    { name: "Sitagliptin",     doseOptions: ["100 mg PO"],schedule: "once daily", rationale: "DPP-4 inhibitor." },
    { name: "Empagliflozin",   doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "SGLT2 inhibitor with cardio-renal benefit." },
    { name: "Dulaglutide",     doseOptions: ["1.5 mg SC"],schedule: "weekly", rationale: "GLP-1 receptor agonist." },
    { name: "Insulin glargine",doseOptions: ["10 units SC"],schedule:"once daily at bedtime", rationale: "Long-acting basal insulin." },
    { name: "Insulin aspart",  doseOptions: ["4 units SC"],schedule: "with meals", rationale: "Rapid-acting prandial insulin." },
    { name: "Atorvastatin",    doseOptions: ["20 mg PO"], schedule: "once daily", rationale: "ASCVD risk reduction." },
    { name: "Lisinopril",      doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "BP control / renal protection in T2DM." },
    { name: "Aspirin",         doseOptions: ["81 mg PO"], schedule: "once daily", rationale: "Secondary cardiovascular prevention (case-by-case)." },
    { name: "Pioglitazone",    doseOptions: ["15 mg PO"], schedule: "once daily", rationale: "Insulin sensitizer." },
    { name: "Metoprolol",      doseOptions: ["25 mg PO"], schedule: "twice daily", rationale: "Cardio-protective in selected patients." }
  ],
  "heart-disease": [
    { name: "Aspirin",         doseOptions: ["81 mg PO"], schedule: "once daily", rationale: "Antiplatelet for ASCVD." },
    { name: "Clopidogrel",     doseOptions: ["75 mg PO"], schedule: "once daily", rationale: "Antiplatelet (DAPT)." },
    { name: "Atorvastatin",    doseOptions: ["40 mg PO"], schedule: "once daily", rationale: "High-intensity statin." },
    { name: "Metoprolol succinate", doseOptions: ["50 mg PO"], schedule: "once daily", rationale: "Beta-blocker for IHD/HF." },
    { name: "Lisinopril",      doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "ACE inhibitor." },
    { name: "Spironolactone",  doseOptions: ["25 mg PO"], schedule: "once daily", rationale: "Aldosterone antagonist for HFrEF." },
    { name: "Furosemide",      doseOptions: ["20 mg PO"], schedule: "once daily", rationale: "Diuretic for volume overload." },
    { name: "Empagliflozin",   doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "SGLT2 inhibitor in HF." },
    { name: "Nitroglycerin SL",doseOptions: ["0.4 mg SL"],schedule: "PRN angina", rationale: "Acute angina relief." },
    { name: "Amiodarone",      doseOptions: ["200 mg PO"],schedule: "once daily", rationale: "Antiarrhythmic (selected cases)." },
    { name: "Warfarin",        doseOptions: ["5 mg PO"],  schedule: "once daily", rationale: "Anticoagulation (INR-guided).", cautions: ["Bleeding"] },
    { name: "Sacubitril/valsartan", doseOptions: ["49/51 mg PO"], schedule: "twice daily", rationale: "ARNI for HFrEF." }
  ],
  "hypertension": [
    { name: "Amlodipine",      doseOptions: ["5 mg PO", "10 mg PO"], schedule: "once daily", rationale: "Calcium channel blocker." },
    { name: "Lisinopril",      doseOptions: ["10 mg PO", "20 mg PO"],schedule: "once daily", rationale: "ACE inhibitor." },
    { name: "Losartan",        doseOptions: ["50 mg PO"], schedule: "once daily", rationale: "ARB." },
    { name: "Hydrochlorothiazide", doseOptions: ["12.5 mg PO"], schedule: "once daily", rationale: "Thiazide diuretic." },
    { name: "Chlorthalidone",  doseOptions: ["25 mg PO"], schedule: "once daily", rationale: "Long-acting thiazide-like diuretic." },
    { name: "Metoprolol",      doseOptions: ["50 mg PO"], schedule: "twice daily", rationale: "Beta-blocker." },
    { name: "Carvedilol",      doseOptions: ["6.25 mg PO"],schedule: "twice daily", rationale: "Non-selective beta-blocker." },
    { name: "Spironolactone",  doseOptions: ["25 mg PO"], schedule: "once daily", rationale: "Resistant hypertension add-on." },
    { name: "Doxazosin",       doseOptions: ["2 mg PO"],  schedule: "at bedtime", rationale: "Alpha-blocker (selected cases)." },
    { name: "Aliskiren",       doseOptions: ["150 mg PO"],schedule: "once daily", rationale: "Direct renin inhibitor." },
    { name: "Atorvastatin",    doseOptions: ["20 mg PO"], schedule: "once daily", rationale: "ASCVD risk reduction." },
    { name: "Aspirin",         doseOptions: ["81 mg PO"], schedule: "once daily", rationale: "Secondary cardiovascular prevention (case-by-case)." }
  ],
  "kidney-disease": [
    { name: "Lisinopril",      doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "ACE inhibitor for proteinuria." },
    { name: "Losartan",        doseOptions: ["50 mg PO"], schedule: "once daily", rationale: "ARB alternative." },
    { name: "Empagliflozin",   doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "SGLT2 inhibitor for CKD progression." },
    { name: "Sevelamer",       doseOptions: ["800 mg PO"],schedule: "with meals", rationale: "Phosphate binder." },
    { name: "Calcitriol",      doseOptions: ["0.25 mcg PO"],schedule: "once daily", rationale: "Active vitamin D for CKD-MBD." },
    { name: "Erythropoietin",  doseOptions: ["50 units/kg SC"], schedule: "3x/week", rationale: "Anemia of CKD." },
    { name: "Furosemide",      doseOptions: ["40 mg PO"], schedule: "once daily", rationale: "Diuretic for volume control." },
    { name: "Sodium bicarbonate", doseOptions: ["650 mg PO"], schedule: "twice daily", rationale: "Metabolic acidosis correction." },
    { name: "Atorvastatin",    doseOptions: ["20 mg PO"], schedule: "once daily", rationale: "ASCVD risk reduction in CKD." },
    { name: "Allopurinol",     doseOptions: ["100 mg PO"],schedule: "once daily", rationale: "Hyperuricemia management." },
    { name: "Iron sucrose",    doseOptions: ["100 mg IV"], schedule: "weekly", rationale: "Iron repletion for renal anemia." },
    { name: "Pantoprazole",    doseOptions: ["40 mg PO"], schedule: "once daily", rationale: "Gastroprotection (selected cases)." }
  ],
  "stroke": [
    { name: "Aspirin",         doseOptions: ["81 mg PO"], schedule: "once daily", rationale: "Secondary prevention." },
    { name: "Clopidogrel",     doseOptions: ["75 mg PO"], schedule: "once daily", rationale: "Antiplatelet alternative." },
    { name: "Atorvastatin",    doseOptions: ["80 mg PO"], schedule: "once daily", rationale: "High-intensity statin post-stroke." },
    { name: "Apixaban",        doseOptions: ["5 mg PO"],  schedule: "twice daily", rationale: "DOAC for AFib-related stroke." },
    { name: "Warfarin",        doseOptions: ["5 mg PO"],  schedule: "once daily", rationale: "Alternative anticoagulant.", cautions: ["Bleeding"] },
    { name: "Lisinopril",      doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "BP control after stroke." },
    { name: "Amlodipine",      doseOptions: ["5 mg PO"],  schedule: "once daily", rationale: "BP control." },
    { name: "Metformin",       doseOptions: ["500 mg PO"],schedule: "twice daily", rationale: "Diabetes management to reduce recurrent stroke risk." },
    { name: "Sertraline",      doseOptions: ["50 mg PO"], schedule: "once daily", rationale: "Post-stroke depression." },
    { name: "Gabapentin",      doseOptions: ["300 mg PO"],schedule: "three times daily", rationale: "Neuropathic pain." },
    { name: "Levetiracetam",   doseOptions: ["500 mg PO"],schedule: "twice daily", rationale: "Post-stroke seizure prophylaxis (case-by-case)." },
    { name: "Pantoprazole",    doseOptions: ["40 mg PO"], schedule: "once daily", rationale: "Gastroprotection on antiplatelets/anticoagulants." }
  ]
};

/**
 * Generic fallback medications for diseases without a hand-curated pool.
 */
export const GENERIC_MEDICATION_POOL: MedicationTemplate[] = [
  { name: "Acetaminophen",   doseOptions: ["500 mg PO", "1000 mg PO"], schedule: "every 6 hours PRN", rationale: "Pain and fever management." },
  { name: "Ibuprofen",       doseOptions: ["200 mg PO", "400 mg PO"],  schedule: "every 6-8 hours PRN", rationale: "Anti-inflammatory pain control.", cautions: ["GI bleeding","Renal caution"] },
  { name: "Pantoprazole",    doseOptions: ["40 mg PO"], schedule: "once daily", rationale: "Gastric protection." },
  { name: "Cetirizine",      doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "Antihistamine adjunct." },
  { name: "Vitamin D3",      doseOptions: ["1000 IU PO"], schedule: "once daily", rationale: "Bone health support." },
  { name: "Multivitamin",    doseOptions: ["1 tablet PO"], schedule: "once daily", rationale: "General supplementation." },
  { name: "Sertraline",      doseOptions: ["50 mg PO"], schedule: "once daily", rationale: "Mood support during chronic illness." },
  { name: "Melatonin",       doseOptions: ["3 mg PO"],  schedule: "at bedtime", rationale: "Sleep support." },
  { name: "Atorvastatin",    doseOptions: ["20 mg PO"], schedule: "once daily", rationale: "Cardiovascular risk reduction (selected cases)." },
  { name: "Aspirin",         doseOptions: ["81 mg PO"], schedule: "once daily", rationale: "Cardiovascular prevention (case-by-case)." },
  { name: "Loratadine",      doseOptions: ["10 mg PO"], schedule: "once daily", rationale: "Allergy adjunct." },
  { name: "Magnesium oxide", doseOptions: ["400 mg PO"],schedule: "once daily", rationale: "Cramp relief support." }
];

export type ExerciseTemplate = {
  name: string;
  description: string;
  frequency: string;
  intensity: "low" | "moderate" | "high";
  cautions?: string[];
};

/**
 * Per-disease exercise programs. lung-cancer hand-curated; others use sensible categories.
 */
export const EXERCISE_POOL: Record<string, ExerciseTemplate[]> = {
  "lung-cancer": [
    { name: "Diaphragmatic breathing",         description: "Slow nasal inhale 4s, hold 2s, exhale through pursed lips 6s.", frequency: "10 min, 3x/day", intensity: "low",      cautions: ["Stop if dyspneic at rest"] },
    { name: "Pursed-lip breathing walks",      description: "Short walks pacing 2 steps inhale, 4 steps exhale.",            frequency: "10-15 min, 2x/day", intensity: "low" },
    { name: "Seated upper-body stretches",     description: "Shoulder rolls, chest opener, side bends to expand the rib cage.", frequency: "5 min, 2x/day", intensity: "low" },
    { name: "Resistance band rows (light)",    description: "Open chest, strengthen scapular retractors to improve posture and breathing mechanics.", frequency: "2 sets x 10, 3x/week", intensity: "low",      cautions: ["Avoid Valsalva"] },
    { name: "Stationary cycling (low load)",   description: "Aerobic conditioning while monitoring SpO2 and dyspnea.",       frequency: "10-20 min, 3-5x/week", intensity: "moderate", cautions: ["Stop if SpO2 < 88%"] },
    { name: "Mindful walking outdoors",        description: "Slow walking with attention to breath and surroundings.",        frequency: "20 min, daily as tolerated", intensity: "low" }
  ],
  "breast-cancer": [
    { name: "Shoulder mobility (post-op)", description: "Gentle wall walks, pendulum swings to restore shoulder ROM.", frequency: "5 min, 3x/day", intensity: "low", cautions: ["Per surgeon clearance"] },
    { name: "Walking program",             description: "Low-impact aerobic activity to manage fatigue and lymphedema risk.", frequency: "20-30 min daily", intensity: "moderate" },
    { name: "Resistance training (light)", description: "Banded rows and presses to preserve lean mass.", frequency: "2-3 sets x 10, 2-3x/week", intensity: "moderate" },
    { name: "Yoga or pilates (modified)",  description: "Stress reduction and core/posture support.", frequency: "20-30 min, 2-3x/week", intensity: "low" }
  ],
  "diabetes": [
    { name: "Brisk walking",          description: "Aerobic activity to improve glycemic control.",                    frequency: "30 min/day, 5x/week", intensity: "moderate" },
    { name: "Resistance training",    description: "Major muscle groups to improve insulin sensitivity.",              frequency: "2-3 sets x 10-12, 2-3x/week", intensity: "moderate" },
    { name: "Cycling or swimming",    description: "Low-impact aerobic alternatives.",                                  frequency: "30 min, 3-5x/week", intensity: "moderate" },
    { name: "Post-meal walks",        description: "10-minute walks after meals to blunt glucose spikes.",              frequency: "After each main meal", intensity: "low" },
    { name: "Mobility / stretching",  description: "Daily mobility for foot care and circulation.",                     frequency: "10 min daily", intensity: "low", cautions: ["Inspect feet daily"] }
  ],
  "heart-disease": [
    { name: "Cardiac-rehab walking",  description: "Supervised walking to build aerobic capacity.",            frequency: "30 min, 3-5x/week", intensity: "moderate", cautions: ["Stop if chest pain"] },
    { name: "Light cycling",          description: "Stationary bike at conversational effort.",               frequency: "20-30 min, 3x/week", intensity: "moderate" },
    { name: "Resistance training",    description: "Light weights with controlled breathing.",                 frequency: "2 sets x 10, 2x/week", intensity: "low",      cautions: ["Avoid Valsalva"] },
    { name: "Stress-reduction",       description: "Box breathing or guided meditation.",                       frequency: "10 min daily", intensity: "low" }
  ],
  "hypertension": [
    { name: "Aerobic exercise",       description: "Walking, cycling, swimming.",                              frequency: "30 min, 5x/week",   intensity: "moderate" },
    { name: "Isometric handgrip",     description: "4 x 2-min handgrip holds at 30% MVC.",                     frequency: "3x/week",            intensity: "moderate" },
    { name: "Resistance training",    description: "Light-to-moderate full-body resistance.",                   frequency: "2-3x/week",          intensity: "moderate" },
    { name: "Yoga / breathing",       description: "Slow breathing under 6 breaths/min for BP modulation.",    frequency: "10 min, 2x/day",     intensity: "low" }
  ],
  "kidney-disease": [
    { name: "Low-impact aerobic",     description: "Walking or stationary cycling.",                            frequency: "20-30 min, 3-5x/week", intensity: "low" },
    { name: "Resistance training",    description: "Bodyweight or banded resistance.",                          frequency: "2-3x/week",            intensity: "low" },
    { name: "Balance work",           description: "Single-leg stands, tandem walks for fall prevention.",      frequency: "10 min, 3x/week",      intensity: "low" },
    { name: "Stretching",             description: "Daily mobility to reduce stiffness on dialysis days.",      frequency: "10 min daily",          intensity: "low" }
  ],
  "stroke": [
    { name: "Task-specific gait practice", description: "Repetitive stepping drills with assistance as needed.", frequency: "30 min, 5x/week", intensity: "moderate" },
    { name: "Upper-extremity reaching",    description: "Reach-grasp-release drills for fine motor recovery.",   frequency: "20 min, daily", intensity: "low" },
    { name: "Balance training",            description: "Sit-to-stand and tandem stance for fall prevention.",   frequency: "15 min, 5x/week", intensity: "low" },
    { name: "Aerobic conditioning",        description: "Recumbent bike to rebuild endurance.",                  frequency: "20 min, 3x/week", intensity: "moderate" }
  ],
  "parkinsons": [
    { name: "Big-amplitude movement (LSVT BIG style)", description: "Large, exaggerated movements to counter bradykinesia.", frequency: "30 min, 4x/week", intensity: "moderate" },
    { name: "Boxing-style training",       description: "Footwork drills and pad work for agility.",               frequency: "45 min, 2x/week", intensity: "moderate" },
    { name: "Tai chi",                     description: "Slow flowing movements for balance.",                       frequency: "30 min, 2-3x/week", intensity: "low" },
    { name: "Stretching",                  description: "Daily ROM for hips, shoulders, neck.",                      frequency: "15 min daily", intensity: "low" }
  ],
  "alzheimers": [
    { name: "Daily walks",            description: "Outdoor walks with a caregiver for routine and safety.", frequency: "20-30 min daily", intensity: "low" },
    { name: "Music + movement",       description: "Familiar music with light dance/sway for mood and engagement.", frequency: "15 min, 5x/week", intensity: "low" },
    { name: "Chair-based exercises",  description: "Seated leg lifts and arm raises.",                          frequency: "10 min, 2x/day",  intensity: "low" },
    { name: "Cognitive games",        description: "Puzzles or memory cards for engagement.",                   frequency: "20 min daily",     intensity: "low" }
  ],
  "sleep-apnea": [
    { name: "Aerobic exercise",       description: "Walking or cycling to improve sleep quality.",        frequency: "30 min, 5x/week",   intensity: "moderate" },
    { name: "Oropharyngeal exercises",description: "Tongue press, soft palate exercises.",                 frequency: "10 min, 2x/day",     intensity: "low" },
    { name: "Side-sleep training",    description: "Positional therapy with side-sleep aids.",             frequency: "Nightly",            intensity: "low" }
  ]
};

export const GENERIC_EXERCISE_POOL: ExerciseTemplate[] = [
  { name: "Walking program",        description: "Low-impact aerobic walks at a conversational pace.", frequency: "20-30 min, 5x/week", intensity: "moderate" },
  { name: "Strength basics",        description: "Sit-to-stands, wall push-ups, banded rows.",          frequency: "2-3 sets x 10, 2-3x/week", intensity: "low" },
  { name: "Mobility & stretching",  description: "Full-body stretches focused on hips, shoulders, neck.", frequency: "10 min daily", intensity: "low" },
  { name: "Mindful breathing",      description: "Box breathing 4-4-4-4 for stress regulation.",         frequency: "10 min, 2x/day", intensity: "low" }
];

export const GENERIC_AFFIRMATIONS = [
  { theme: "presence",     statement: "I take this one breath, one moment at a time." },
  { theme: "agency",       statement: "I am an active participant in my own care, not a passive observer." },
  { theme: "support",      statement: "I let trusted people walk beside me on this path." },
  { theme: "compassion",   statement: "I extend the same kindness to myself that I would to a dear friend." },
  { theme: "hope",         statement: "Healing is not linear; small steps still count." },
  { theme: "rest",         statement: "Resting is part of getting better, not the opposite of it." },
  { theme: "trust",        statement: "I trust the team and the process even when it is hard." },
  { theme: "celebration",  statement: "I notice and celebrate every small improvement." }
];

/**
 * Per-disease affirmations. Falls back to GENERIC_AFFIRMATIONS for any slug not listed here.
 */
export const AFFIRMATION_POOL: Record<string, { theme: string; statement: string }[]> = {
  "lung-cancer": [
    { theme: "breath",       statement: "Each breath I take is a gentle act of healing." },
    { theme: "strength",     statement: "My body has carried me this far; I trust it to keep showing up." },
    { theme: "support",      statement: "I let my care team and loved ones share this load with me." },
    { theme: "presence",     statement: "Today I focus on this hour, not the whole journey." },
    { theme: "agency",       statement: "I make informed choices and ask the questions I need to ask." },
    { theme: "rest",         statement: "Rest is treatment too; I let myself slow down without guilt." },
    { theme: "hope",         statement: "Hope and realism can live in me at the same time." },
    { theme: "celebration",  statement: "I notice every small win - a steady walk, a calm night, a clear scan." }
  ],
  "breast-cancer": [
    { theme: "wholeness",  statement: "I am whole regardless of what changes my body goes through." },
    { theme: "support",    statement: "I am surrounded by people who want me to thrive." },
    { theme: "courage",    statement: "Brave is something I get to be in small daily ways." },
    { theme: "rest",       statement: "Sleep and slow days are part of my recovery, not detours from it." }
  ],
  "diabetes": [
    { theme: "agency",     statement: "I make one healthy choice at a time, and they add up." },
    { theme: "compassion", statement: "A tough number is information, not a verdict on me." },
    { theme: "consistency",statement: "Small consistent actions outperform perfect ones." },
    { theme: "hope",       statement: "My health is something I can keep building, day by day." }
  ],
  "heart-disease": [
    { theme: "calm",     statement: "My heart responds well to calm breathing and gentle movement." },
    { theme: "rhythm",   statement: "I create a daily rhythm my body can rely on." },
    { theme: "support",  statement: "Asking for help is part of how I take care of myself." }
  ],
  "stroke": [
    { theme: "patience", statement: "Recovery is slow, and slow is still moving forward." },
    { theme: "agency",   statement: "Every rep, every step, every word - they all count." },
    { theme: "support",  statement: "My therapists and family are partners in my comeback." }
  ],
  "alzheimers": [
    { theme: "presence", statement: "I cherish this moment exactly as it is." },
    { theme: "love",     statement: "I am loved for who I am, not for what I remember." },
    { theme: "routine",  statement: "Familiar routines are a kind of safety I get to enjoy." }
  ]
};
