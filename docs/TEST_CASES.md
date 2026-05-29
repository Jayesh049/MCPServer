# Doctor–Patient Platform — Test Cases (Disease Board, Consultation, Ratings, DigiLocker)

Scope: doctor degree validation (DigiLocker), patient disease-board posts, doctor
comment/reply, consultation request + doctor approval, bilateral 10-point ratings with
10-form + signature, consultation recording, and **automated** rating validation.

Backend base URL: `http://127.0.0.1:3333/api/platform`
Automated runner: `npm run test:platform-flows` (57 assertions, currently green) — includes
explicit DB read-after-write persistence checks (posts, comments, replies, likes, messages,
recordings, consents, ratings).

A companion **Medical Hub** suite (`npm run test:medical-hub`, 161 assertions) covers the
disease analyzer, all 20 disease prediction pipelines, the report analyzer, RAG, and Ayurveda —
see section 7 below. Run both with `npm run test:e2e`.

Legend — **Type**: A = covered by automated runner, M = manual/UI.

---

## 1. Authentication & Accounts

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| TC-01 | Patient registration | POST `/auth/register` role=PATIENT | 201, JWT token + user stored in DB | A |
| TC-02 | Doctor registration | POST `/auth/register` role=DOCTOR with specialty/regNo | 201, JWT token, doctor profile created | A |
| TC-03 | Duplicate email blocked | Register same email twice | 2nd attempt → 400 "Email already registered" | A |
| TC-04 | Login wrong password | POST `/auth/login` bad password | 401 "Invalid credentials" | A |
| TC-05 | Login correct password | POST `/auth/login` valid creds | 200 + token | A |
| TC-06 | Session check valid | GET `/auth/me` with token | `valid:true` + user | A |
| TC-07 | Session check missing token | GET `/auth/me` no header | 401 unauthorized | A |
| TC-08 | 2FA enrolment | POST `/auth/2fa/setup` then `/auth/2fa/enable` | QR returned; valid TOTP enables 2FA | M |

## 2. DigiLocker Doctor Degree Validation

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| TC-09 | Start flow as doctor | GET `/doctors/digilocker/start` (doctor) | 200 + `authUrl` (configured) **or** clear "not configured" guard | A |
| TC-10 | Start flow blocked for patient | GET `/doctors/digilocker/start` (patient) | 403 doctors-only | A |
| TC-11 | Callback marks verified | GET `/doctors/digilocker/callback?code&state` | DoctorVerification row created; doctor `verified` updated; degree URI stored (hashed) | M |
| TC-12 | Verification status | GET `/doctors/verification-status` (doctor) | returns `verified` flag + verification history | A |
| TC-13 | Invalid/expired state | callback with unknown state | 400 invalid/expired state | M |

## 3. Disease Board (Posts) & Visibility

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| TC-14 | Patient creates post | POST `/posts` (patient) | 201, post id returned | A |
| TC-15 | Doctor cannot create post | POST `/posts` (doctor) | 403 patients-only | A |
| TC-16 | Doctor sees all posts | GET `/posts` (doctor) | board includes the patient's post | A |
| TC-17 | Author sees own post | GET `/posts` (author patient) | own post visible | A |
| TC-18 | Other patient cannot see foreign post | GET `/posts` (different patient) | post NOT visible (no leakage) | A |
| TC-19 | Comment on a post | POST `/posts/:id/comment` | 201, comment returned with author role | A |
| TC-20 | Like / unlike toggle | POST `/posts/:id/like` twice | first like→count 1; second→count 0 | A |

## 4. Consultation Request & Doctor Approval

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| TC-21 | Consult blocked before reply | POST `/consultations/start` before any doctor reply | 403 "after the doctor replies" | A |
| TC-22 | Doctor replies to post | POST `/posts/:id/reply` (doctor) | 201, reply stored | A |
| TC-23 | Patient cannot reply as doctor | POST `/posts/:id/reply` (patient) | 403 doctors-only | A |
| TC-24 | Consult starts after reply | POST `/consultations/start` (patient) | consultation created, status `REQUESTED` | A |
| TC-25 | Messaging blocked before approval | POST `/consultations/:id/message` while REQUESTED | 403 "doctor must approve" | A |
| TC-26 | Patient cannot self-approve | POST `/consultations/:id/respond` (patient) | 403 | A |
| TC-27 | Doctor approves → ACTIVE | POST `/consultations/:id/respond` ACCEPT (doctor) | status ACTIVE; messaging now allowed | A |
| TC-28 | Re-decide blocked | respond again on ACTIVE consult | 409 already-decided | A |
| TC-29 | Doctor can decline | respond REJECT on a REQUESTED consult | status REJECTED; messaging stays blocked | M |

## 5. Recording, 10-Star Ratings & Automated Validation

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| TC-30 | Recording needs dual consent | POST `/consultations/:id/recording` before both consents | 400 consent required | A |
| TC-31 | Recording ingested after consent | both `consent-recording` then `/recording` | 201, recording (transcript/duration) stored | A |
| TC-32 | Rating needs 10 forms | POST `/ratings/doctor` with <10 answers | 400 "10-form answers required" | A |
| TC-33 | Valid doctor rating | POST `/ratings/doctor` score+10 forms+signature | 201; auto-validation runs | A |
| TC-34 | Good-evidence rating APPROVED | rating on consult with messages + recording | `autoDecision = APPROVED` | A |
| TC-35 | Thin-evidence rating FLAGGED | rating on consult with no messages/consent | `autoDecision = FLAGGED` with reason flags | A |
| TC-36 | Doctor cannot rate doctor | POST `/ratings/doctor` (doctor) | 403 patients-only | A |
| TC-37 | Doctor rates patient | POST `/ratings/patient` 10 forms+signature | 201 patient rating stored | A |
| TC-38 | Doctor 10-scale rating shown | GET `/doctors` (patient) | doctor listed, `ratingOutOf:10`, ratingCount ≥ 1 | A |
| TC-39 | Patient 10-scale rating shown | GET `/patients` (doctor) | patient listed with `ratingOutOf:10` | A |
| TC-40 | Manual review queue (doctor) | GET `/ratings/review-queue` (doctor) | flagged/pending runs returned | A |
| TC-41 | Review queue blocked for patient | GET `/ratings/review-queue` (patient) | 403 | A |
| TC-42 | Reviewer override decision | POST `/ratings/review/:id` APPROVED/REJECTED | run + linked rating status updated | M |

## 6. Robustness / Security

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| TC-43 | Unknown route | GET `/nope` | 404 unknown route | A |
| TC-44 | Protected route without token | any protected GET/POST without JWT | 401 | A |
| TC-45 | Cross-tenant consult guard | rate/respond on a consult you are not part of | 404 not-found (no access) | A |
| TC-46 | SQL/JSON safety on forms | submit large/odd `formAnswers` JSON | stored as JSON, no crash | M |

## 6b. DB Persistence (read-after-write)

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| TC-47 | Post survives reload | GET `/posts` after create | post retrievable on a fresh read | A |
| TC-48 | Comment persisted | GET `/posts` after comment | comment text present on the post | A |
| TC-49 | Doctor reply persisted | GET `/posts` after reply | reply text present under `doctorReplies` | A |
| TC-50 | Like persisted + likedByMe | re-like then GET `/posts` | `likes=1`, `likedByMe=true` for the liker | A |
| TC-51 | Consultation state persisted | GET `/consultations/:id` | status `ACTIVE`, dual consent flags stored | A |
| TC-52 | Messages persisted | GET `/consultations/:id` | ≥3 messages stored in order | A |
| TC-53 | Recording persisted | GET `/consultations/:id` | recording row with transcript/duration | A |
| TC-54 | Ratings persisted on consult | GET `/consultations/:id` | doctor + patient rating rows present | A |
| TC-55 | List reflects message count | GET `/consultations` | `messageCount ≥ 3` for the thread | A |

---

## 7. Medical Hub — Disease Analyzer, Predictions, Report, RAG, Ayurveda

Backend base URL: `http://127.0.0.1:3333/api`
Automated runner: `npm run test:medical-hub` (161 assertions, currently green).
All disease models are really trained: 12 imaging sklearn HOG+histogram classifiers, the
TB TF-IDF text model, and the self-trained diabetes logistic regression. The suite **STRICT**ly
fails if any imaging slug falls back to the synthetic stub.

| # | Title | Steps | Expected result | Type |
|---|-------|-------|-----------------|------|
| MH-01 | Health endpoint | GET `/health` | 200 `{ ok: true }` | A |
| MH-02 | Disease registry | GET `/diseases` | 20 diseases across imaging/clinical/signal, each with `inputSpec` + `modelKind` | A |
| MH-03 | Imaging prediction (×12) | POST `/diseases/:slug/predict` with PNG (brain-tumor, pneumonia, tuberculosis*, covid-19, skin-cancer, diabetic-retinopathy, glaucoma, cataract, breast-cancer, lung-cancer, bone-fracture, alzheimers) | 200; detection + resolution.steps + solution; **trained** model marker (`Mode=sklearn_imaging_ml`), not a stub | A |
| MH-04 | TB text model | POST `/diseases/tuberculosis/predict` with `form.reportText` | trained TB sklearn used (`Mode=sklearn_tb2_ml`) | A |
| MH-05 | Diabetes (clinical) | POST `/diseases/diabetes/predict` high glucose/A1c | self-trained logistic regression; elevated risk | A |
| MH-06 | Heart disease (Framingham) | POST `/diseases/heart-disease/predict` high-risk profile | 10-yr Framingham signal; medium/high | A |
| MH-07 | Kidney disease (CKD-EPI) | POST `/diseases/kidney-disease/predict` high creatinine | eGFR signal; medium/high | A |
| MH-08 | Kidney honors provided eGFR | POST with `egfr=22` | high risk (directly-provided eGFR respected) | A |
| MH-09 | Liver disease (NAFLD) | POST `/diseases/liver-disease/predict` abnormal LFTs | NAFLD fibrosis-score signal | A |
| MH-10 | Stroke (CHA₂DS₂-VASc) | POST `/diseases/stroke/predict` afib+diabetes+priorStroke | high; afib/diabetes/smoker now change the score | A |
| MH-11 | Hypertension (ACC/AHA) | POST `/diseases/hypertension/predict` crisis BP + `ageOver60` | high; ACC/AHA stage signal | A |
| MH-12 | Parkinson's (signal) | POST `/diseases/parkinsons/predict` jitter/shimmer/HNR | medium/high acoustic risk | A |
| MH-13 | Sleep apnea (STOP-BANG) | POST `/diseases/sleep-apnea/predict` all yes | high | A |
| MH-14 | Care plan | GET `/diseases/:slug/care-plan` | `synthetic:true`, 5 doctors, exercises + affirmations | A |
| MH-15 | Report analyzer (text) | POST `/report/analyze` `{pdfText}` | detects diseases incl. diabetes; primary + synthetic care plan | A |
| MH-16 | Report analyzer (CSV) | POST `/report/analyze` `{csvText}` | detects diseases from tabular labs | A |
| MH-17 | Report analyzer (PDF) | POST `/report/analyze` `{pdfBase64}` (generated text PDF) | ≥1 page extracted; diseases detected | A |
| MH-18 | RAG catalog | GET `/rag/catalog` | non-empty catalog object | A |
| MH-19 | RAG dynamic ask | POST `/rag/ask` `{question}` | `indexedChunks>0`, `topMatches`, `answerPreview` | A |
| MH-20 | RAG bank ask | POST `/rag/ask-bank` `{slug: qb_001}` | indexed chunks + topMatches from trained corpus | A |
| MH-21 | Ayurveda yoga | GET `/ayurveda/yoga?disease=diabetes` | asanas + pranayama + grounded citations | A |
| MH-22 | Training health gate | (end of suite) | every imaging model TRAINED; STRICT fails on any stub | A |

\* `tuberculosis` predicts from chest X-ray (HF model when reachable) **and** from clinical
report text via the trained TB sklearn model; MH-04 exercises the trained text path.

---

### How to run the automated suites

```powershell
# 1) Start backend (port 3333) — loads .env (RAG_EMBEDDING_PROVIDER=local, IMAGING_ML_PYTHON, etc.)
npm run dev

# 2) In another terminal — run both suites
$env:BASE_URL="http://127.0.0.1:3333"
npm run test:medical-hub      # Medical Hub (161 assertions)
npm run test:platform-flows   # Doctor/Patient platform (57 assertions)
npm run test:e2e              # both, sequentially
```

One-time training prerequisites (already produced in this repo):

```powershell
pip install -r ml/requirements-imaging.txt   # numpy/pandas/scikit-learn/Pillow/huggingface_hub/pypdf
npm run train:imaging:download                # downloads chest X-ray / MRI / fundus datasets
python ml/scripts/train_imaging_classifier.py # trains all imaging sklearn models -> ml/artifacts/imaging/<slug>/pipeline.joblib
npm run db:train-ayurveda                     # indexes classical yoga texts (local embeddings)
npm run db:train-bank                         # indexes Wikipedia-backed bank questions (qb_*)
```


////////////////////////////////////


# 1) Kaun sa process port 3333 use kar raha hai
Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue | Select-Object OwningProcess

# 2) Us process ko kill karo (PID upar wale output se aayegi)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3333 -State Listen).OwningProcess -Force

# 3) Backend start karo
cd "C:\Users\NICSI005\OneDrive - Energy Efficiency Services Limited\MCPServer"
$env:MCP_TRANSPORT="http"
$env:PORT="3333"
npm run dev

/////////////////one liner

Stop-Process -Id (Get-NetTCPConnection -LocalPort 3333 -State Listen).OwningProcess -Force -ErrorAction SilentlyContinue