/**
 * End-to-end automation for the Medical Hub against the live backend.
 *
 * Covers (all against http://127.0.0.1:3333 by default):
 *   - GET /api/health
 *   - GET /api/diseases  (20 slugs, categories, inputSpec)
 *   - POST /api/diseases/:slug/predict for ALL 20 diseases
 *       * 10 self-trained sklearn imaging models (STRICT: must be trained, not a stub)
 *       * pneumonia (Hugging Face ViT) + tuberculosis (sklearn TB text) — STRICT non-stub
 *       * 6 clinical calculators + 2 signal/questionnaire models (high-risk exercises)
 *   - GET /api/diseases/:slug/care-plan (synthetic care plan structure)
 *   - POST /api/report/analyze with pdfText, csvText, and an in-script generated text PDF
 *   - GET /api/rag/catalog ; POST /api/rag/ask ; POST /api/rag/ask-bank
 *   - GET /api/ayurveda/yoga?disease=...
 *   - A "training health" table: trained-vs-stub per imaging disease (STRICT gate)
 *
 * Fixtures (PNG image + text PDF) are generated in-process — no external binaries.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3333 node scripts/test-medical-hub.mjs
 *   RAG_BANK_SLUG=qb_001 node scripts/test-medical-hub.mjs   # which indexed bank slug to query
 *   MEDHUB_STRICT=0 node scripts/test-medical-hub.mjs        # relax strict trained-model gate
 */
import zlib from "node:zlib";

const baseRaw = process.env.BASE_URL ?? "http://127.0.0.1:3333";
const base = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;
const STRICT = (process.env.MEDHUB_STRICT ?? "1") !== "0";
const RAG_BANK_SLUG = process.env.RAG_BANK_SLUG ?? "qb_001";

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  passed += 1;
  console.log(`  PASS  ${name}`);
}
function bad(name, detail) {
  failed += 1;
  failures.push({ name, detail });
  console.log(`  FAIL  ${name} -> ${detail}`);
}
function assert(name, cond, detail = "condition was false") {
  if (cond) ok(name);
  else bad(name, detail);
}

async function callApi(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const getApi = (p) => callApi("GET", p);
const postApi = (p, body) => callApi("POST", p, body ?? {});

// --------------------------------------------------------------------------
// Fixture: minimal valid PNG (RGB) generated with zlib — no external binary.
// --------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
/** Build a valid sizexsize RGB PNG; pixelFn(x,y) -> [r,g,b]. */
function makePng(size, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(size * (1 + size * 3));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x, y);
      raw[o++] = r & 0xff;
      raw[o++] = g & 0xff;
      raw[o++] = b & 0xff;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}
// Two visually distinct fixtures so feature extraction sees real variation.
const pngDark = makePng(96, (x, y) => {
  const v = (x * 2 + y * 3) % 64;
  return [v, v + 10, v + 20];
}).toString("base64");
const pngBright = makePng(96, (x, y) => {
  const v = 180 + ((x ^ y) % 60);
  return [v, v - 20, v - 40];
}).toString("base64");

// --------------------------------------------------------------------------
// Fixture: minimal valid single-page text PDF (searchable) — no external binary.
// --------------------------------------------------------------------------
function makeTextPdf(lines) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let content = "BT /F1 12 Tf 72 740 Td 16 TL\n";
  lines.forEach((ln, i) => {
    content += `(${esc(ln)}) Tj` + (i < lines.length - 1 ? " T*\n" : "\n");
  });
  content += "ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1").toString("base64");
}

// --------------------------------------------------------------------------
// Helpers to read prediction markers
// --------------------------------------------------------------------------
function signalVal(detection, label) {
  const s = (detection?.signals ?? []).find((x) => x.label === label);
  return s ? s.value : undefined;
}
function isSklearnImaging(detection) {
  return signalVal(detection, "Mode") === "sklearn_imaging_ml";
}
function isSynthStub(detection) {
  const r = String(detection?.rationale ?? "");
  return /SYNTHETIC STUB/i.test(r) || signalVal(detection, "Content-aware stub score") !== undefined;
}

const SKLEARN_IMAGING = [
  "brain-tumor",
  "covid-19",
  "skin-cancer",
  "diabetic-retinopathy",
  "glaucoma",
  "cataract",
  "breast-cancer",
  "lung-cancer",
  "bone-fracture",
  "alzheimers"
];

async function predict(slug, payload) {
  return postApi(`/api/diseases/${slug}/predict`, payload);
}

function assertPredictionShape(slug, data) {
  const d = data.detection;
  assert(`${slug}: returns detection.classification`, !!d?.classification, JSON.stringify(data).slice(0, 200));
  assert(`${slug}: riskLevel is low|medium|high`, ["low", "medium", "high"].includes(d?.riskLevel), String(d?.riskLevel));
  assert(`${slug}: resolution.steps non-empty`, Array.isArray(data.resolution?.steps) && data.resolution.steps.length > 0, JSON.stringify(data.resolution));
  assert(`${slug}: solution attached`, !!data.solution, "no solution");
}

async function main() {
  console.log(`\n=== Medical Hub tests against ${base} (strict=${STRICT}) ===\n`);
  const trainingHealth = [];

  // --- Health + registry ----------------------------------------------------
  const health = await getApi("/api/health");
  assert("GET /api/health -> ok", health.status === 200 && health.data.ok === true, JSON.stringify(health.data));

  const diseasesRes = await getApi("/api/diseases");
  const diseases = diseasesRes.data.diseases ?? [];
  assert("GET /api/diseases -> 20 diseases", diseases.length === 20, `count=${diseases.length}`);
  const cats = new Set(diseases.map((d) => d.category));
  assert("disease categories include imaging+clinical+signal", cats.has("imaging") && cats.has("clinical") && cats.has("signal"), [...cats].join(","));
  assert("each disease has inputSpec + modelKind", diseases.every((d) => !!d.inputSpec && !!d.modelKind), "missing inputSpec/modelKind");

  // --- Imaging: 10 sklearn models (STRICT trained) --------------------------
  for (const slug of SKLEARN_IMAGING) {
    const img = slug === "covid-19" || slug === "lung-cancer" ? pngDark : pngBright;
    const res = await predict(slug, { imageBase64: img, imageMimeType: "image/png" });
    assert(`${slug}: predict -> 200`, res.status === 200, JSON.stringify(res.data).slice(0, 200));
    assertPredictionShape(slug, res.data);
    const trained = isSklearnImaging(res.data.detection);
    trainingHealth.push({ slug, kind: "sklearn-imaging", trained, stub: isSynthStub(res.data.detection) });
    if (STRICT) {
      assert(`${slug}: STRICT uses trained sklearn model (Mode=sklearn_imaging_ml)`, trained, JSON.stringify(res.data.detection?.signals));
      assert(`${slug}: STRICT not a synthetic stub`, !isSynthStub(res.data.detection), String(res.data.detection?.rationale).slice(0, 160));
    }
  }

  // --- Pneumonia (Hugging Face ViT) -----------------------------------------
  {
    const res = await predict("pneumonia", { imageBase64: pngBright, imageMimeType: "image/png" });
    assert("pneumonia: predict -> 200", res.status === 200, JSON.stringify(res.data).slice(0, 200));
    assertPredictionShape("pneumonia", res.data);
    const provider = signalVal(res.data.detection, "Provider");
    const mode = signalVal(res.data.detection, "Mode");
    const stub = signalVal(res.data.detection, "isStub") === "true" || isSynthStub(res.data.detection);
    const trained = mode === "sklearn_imaging_ml" || provider === "huggingface" || provider === "flask_sidecar";
    trainingHealth.push({ slug: "pneumonia", kind: mode === "sklearn_imaging_ml" ? "sklearn-imaging" : "huggingface-vit", trained, stub: !trained });
    if (STRICT) {
      assert("pneumonia: STRICT served by a trained model (sklearn or HF), not stub", trained && !stub, `mode=${mode}, provider=${provider}, stub=${stub}`);
    }
  }

  // --- Tuberculosis (sklearn TB text model) ---------------------------------
  {
    const reportText =
      "Clinical summary: chronic productive cough for six weeks with hemoptysis, drenching night sweats, " +
      "low grade fever and significant weight loss. Chest radiograph shows right upper lobe cavitary lesion. " +
      "Sputum AFB smear positive; GeneXpert MTB/RIF detected, rifampicin sensitive. Findings consistent with active pulmonary tuberculosis.";
    const res = await predict("tuberculosis", { form: { reportText } });
    assert("tuberculosis: predict -> 200", res.status === 200, JSON.stringify(res.data).slice(0, 200));
    assertPredictionShape("tuberculosis", res.data);
    const mode = signalVal(res.data.detection, "Mode");
    trainingHealth.push({ slug: "tuberculosis", kind: "sklearn-tb-text", trained: mode === "sklearn_tb2_ml", stub: false });
    if (STRICT) {
      assert("tuberculosis: STRICT uses trained TB sklearn text model", mode === "sklearn_tb2_ml", JSON.stringify(res.data.detection?.signals));
    }
  }

  // --- Clinical calculators (high-risk inputs) ------------------------------
  const diabetes = await predict("diabetes", { form: { age: 62, bmi: 34, fastingGlucose: 215, a1c: 9.2, familyHistory: true } });
  assertPredictionShape("diabetes", diabetes.data);
  assert("diabetes: self-trained logistic-regression model used", signalVal(diabetes.data.detection, "Mode") === "self_trained_logistic_regression" || signalVal(diabetes.data.detection, "Predicted probability") !== undefined, JSON.stringify(diabetes.data.detection?.signals));
  assert("diabetes: high glucose drives elevated risk", ["medium", "high"].includes(diabetes.data.detection?.riskLevel), diabetes.data.detection?.riskLevel);

  const heart = await predict("heart-disease", { form: { age: 67, sex: "male", totalCholesterol: 285, hdl: 31, systolicBp: 168, smoker: true, diabetic: true } });
  assertPredictionShape("heart-disease", heart.data);
  assert("heart-disease: Framingham 10-yr risk signal present", signalVal(heart.data.detection, "10-yr risk (Framingham)") !== undefined, JSON.stringify(heart.data.detection?.signals));
  assert("heart-disease: high-risk profile -> medium/high", ["medium", "high"].includes(heart.data.detection?.riskLevel), heart.data.detection?.riskLevel);

  const kidney = await predict("kidney-disease", { form: { creatinine: 3.4, uacr: 180 } });
  assertPredictionShape("kidney-disease", kidney.data);
  assert("kidney-disease: eGFR signal present", signalVal(kidney.data.detection, "Estimated eGFR (mL/min/1.73m²)") !== undefined, JSON.stringify(kidney.data.detection?.signals));
  assert("kidney-disease: high creatinine -> medium/high", ["medium", "high"].includes(kidney.data.detection?.riskLevel), kidney.data.detection?.riskLevel);
  // Honor directly-provided eGFR (additive input fix)
  const kidneyEgfr = await predict("kidney-disease", { form: { egfr: 22 } });
  assert("kidney-disease: directly-provided low eGFR -> high risk", kidneyEgfr.data.detection?.riskLevel === "high", `egfr=22 -> ${kidneyEgfr.data.detection?.riskLevel}`);

  const liver = await predict("liver-disease", { form: { alt: 130, ast: 250, bilirubin: 3.2, albumin: 2.7 } });
  assertPredictionShape("liver-disease", liver.data);
  assert("liver-disease: NAFLD fibrosis signal present", signalVal(liver.data.detection, "NAFLD fibrosis score") !== undefined, JSON.stringify(liver.data.detection?.signals));

  const stroke = await predict("stroke", { form: { age: 80, afib: true, hypertension: true, diabetes: true, priorStroke: true, smoker: true } });
  assertPredictionShape("stroke", stroke.data);
  assert("stroke: CHA2DS2-VASc signal present", signalVal(stroke.data.detection, "CHA₂DS₂-VASc score") !== undefined, JSON.stringify(stroke.data.detection?.signals));
  assert("stroke: severe risk-factor profile -> high", stroke.data.detection?.riskLevel === "high", stroke.data.detection?.riskLevel);
  // Additive input fix: afib/diabetes must actually influence the score.
  const strokeLow = await predict("stroke", { form: { age: 40 } });
  assert("stroke: afib+diabetes inputs change the score (not ignored)", Number(signalVal(stroke.data.detection, "CHA₂DS₂-VASc score")) > Number(signalVal(strokeLow.data.detection, "CHA₂DS₂-VASc score")), `${signalVal(stroke.data.detection, "CHA₂DS₂-VASc score")} vs ${signalVal(strokeLow.data.detection, "CHA₂DS₂-VASc score")}`);

  const htn = await predict("hypertension", { form: { systolic: 186, diastolic: 124, ageOver60: true } });
  assertPredictionShape("hypertension", htn.data);
  assert("hypertension: ACC/AHA stage signal present", signalVal(htn.data.detection, "ACC/AHA Stage") !== undefined, JSON.stringify(htn.data.detection?.signals));
  assert("hypertension: crisis BP -> high", htn.data.detection?.riskLevel === "high", htn.data.detection?.riskLevel);

  // --- Signal/questionnaire models ------------------------------------------
  const parkinsons = await predict("parkinsons", { form: { jitter: 4, shimmer: 9, hnr: 7, tremorReported: true } });
  assertPredictionShape("parkinsons", parkinsons.data);
  assert("parkinsons: elevated acoustic signals -> medium/high", ["medium", "high"].includes(parkinsons.data.detection?.riskLevel), parkinsons.data.detection?.riskLevel);

  const apnea = await predict("sleep-apnea", { form: { snoring: true, tired: true, observedApnea: true, highBp: true, bmiOver35: true, ageOver50: true, neckOver40cm: true, male: true } });
  assertPredictionShape("sleep-apnea", apnea.data);
  assert("sleep-apnea: all STOP-BANG yes -> high", apnea.data.detection?.riskLevel === "high", apnea.data.detection?.riskLevel);

  // --- Care plans -----------------------------------------------------------
  for (const slug of ["diabetes", "tuberculosis", "brain-tumor"]) {
    const cp = await getApi(`/api/diseases/${slug}/care-plan`);
    assert(`${slug}: care-plan -> 200 synthetic`, cp.status === 200 && cp.data.synthetic === true, JSON.stringify(cp.data).slice(0, 160));
    assert(`${slug}: care-plan has 5 synthetic doctors`, (cp.data.topDoctors ?? []).length === 5, `count=${(cp.data.topDoctors ?? []).length}`);
    assert(`${slug}: care-plan has exercises + affirmations`, (cp.data.exercises ?? []).length > 0 && (cp.data.affirmations ?? []).length > 0, "missing exercises/affirmations");
  }

  // --- Report analyzer ------------------------------------------------------
  const reportLines = [
    "DISCHARGE SUMMARY - Internal Medicine",
    "History: 62 year old with type 2 diabetes mellitus and hypertension.",
    "Labs: HbA1c 9.1 percent, fasting glucose 210 mg/dL. Blood pressure 150/95 mmHg.",
    "Impression: poorly controlled type 2 diabetes with hyperglycemia.",
    "Assessment: continue metformin, reinforce diet and exercise."
  ];
  const reportText = reportLines.join("\n");

  const rText = await postApi("/api/report/analyze", { pdfText: reportText });
  assert("report(pdfText): -> 200", rText.status === 200, JSON.stringify(rText.data).slice(0, 160));
  assert("report(pdfText): detects diseases", (rText.data.detectedDiseases ?? []).length > 0, JSON.stringify(rText.data.detectedDiseases));
  assert("report(pdfText): detects diabetes", (rText.data.detectedDiseases ?? []).some((d) => d.slug === "diabetes"), JSON.stringify(rText.data.detectedDiseases?.map((d) => d.slug)));
  assert("report(pdfText): primaryDisease + synthetic care plan", !!rText.data.primaryDisease && rText.data.carePlan?.synthetic === true, JSON.stringify(rText.data.primaryDisease));

  const csvText =
    "test,value,unit\nHbA1c,9.1,%\nFasting glucose,210,mg/dL\nDiagnosis,type 2 diabetes mellitus,\nBlood pressure,150/95,mmHg\n";
  const rCsv = await postApi("/api/report/analyze", { csvText, filename: "labs.csv" });
  assert("report(csvText): -> 200 + detects diseases", rCsv.status === 200 && (rCsv.data.detectedDiseases ?? []).length > 0, JSON.stringify(rCsv.data.detectedDiseases));

  const pdfBase64 = makeTextPdf(reportLines);
  const rPdf = await postApi("/api/report/analyze", { pdfBase64, pdfFilename: "report.pdf" });
  assert("report(pdfBase64): -> 200", rPdf.status === 200, JSON.stringify(rPdf.data).slice(0, 200));
  assert("report(pdfBase64): extracted >=1 page", (rPdf.data.input?.pages ?? rPdf.data.extracted?.pages ?? 0) >= 1, JSON.stringify(rPdf.data.input ?? rPdf.data.extracted));
  assert("report(pdfBase64): detects diseases from extracted text", (rPdf.data.detectedDiseases ?? []).length > 0, JSON.stringify(rPdf.data.detectedDiseases?.map?.((d) => d.slug)));

  // --- RAG ------------------------------------------------------------------
  const catalog = await getApi("/api/rag/catalog");
  assert("rag catalog -> 200 object", catalog.status === 200 && typeof catalog.data === "object" && Object.keys(catalog.data).length > 0, JSON.stringify(catalog.data).slice(0, 120));

  const ask = await postApi("/api/rag/ask", { question: "What is type 2 diabetes mellitus and how is it managed?" });
  assert("rag ask -> 200", ask.status === 200, JSON.stringify(ask.data).slice(0, 160));
  assert("rag ask: indexed chunks > 0", (ask.data.indexedChunks ?? 0) > 0, `indexedChunks=${ask.data.indexedChunks}`);
  assert("rag ask: topMatches + answerPreview", (ask.data.topMatches ?? []).length > 0 && typeof ask.data.answerPreview === "string" && ask.data.answerPreview.length > 0, JSON.stringify({ tm: ask.data.topMatches?.length, ap: ask.data.answerPreview?.length }));

  const askBank = await postApi("/api/rag/ask-bank", { slug: RAG_BANK_SLUG });
  assert(`rag ask-bank (${RAG_BANK_SLUG}) -> 200`, askBank.status === 200, JSON.stringify(askBank.data).slice(0, 160));
  assert(`rag ask-bank (${RAG_BANK_SLUG}): indexed chunks > 0`, (askBank.data.indexedChunks ?? 0) > 0, `indexedChunks=${askBank.data.indexedChunks}`);
  assert(`rag ask-bank (${RAG_BANK_SLUG}): topMatches present`, (askBank.data.topMatches ?? []).length > 0, `topMatches=${askBank.data.topMatches?.length}`);

  // --- Ayurveda -------------------------------------------------------------
  const ayu = await getApi("/api/ayurveda/yoga?disease=diabetes");
  assert("ayurveda yoga -> 200 ok", ayu.status === 200 && ayu.data.ok === true, JSON.stringify(ayu.data).slice(0, 200));
  assert("ayurveda: asanas + pranayama returned", (ayu.data.result?.asanas ?? []).length > 0 && (ayu.data.result?.pranayama ?? []).length > 0, JSON.stringify({ a: ayu.data.result?.asanas?.length, p: ayu.data.result?.pranayama?.length }));
  assert("ayurveda: grounded citations returned", (ayu.data.result?.citations ?? []).length > 0, JSON.stringify(ayu.data.result?.citations?.length));

  // --- Training health table ------------------------------------------------
  console.log("\n--- Training health (imaging) ---");
  for (const row of trainingHealth) {
    console.log(`  ${row.trained ? "TRAINED" : "STUB   "}  ${row.slug.padEnd(22)} [${row.kind}]`);
  }
  const stubbed = trainingHealth.filter((r) => !r.trained).map((r) => r.slug);
  if (STRICT) {
    assert("STRICT: every imaging model is trained (no stubs)", stubbed.length === 0, `stubbed: ${stubbed.join(", ") || "none"}`);
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(` - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Runner crashed:", e);
  process.exit(1);
});
