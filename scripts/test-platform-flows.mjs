/**
 * End-to-end flow + assertion test runner for the doctor/patient platform.
 *
 * Covers: auth, DigiLocker config guard, disease board (doctor-only visibility),
 * doctor comment/reply, consultation request + doctor approval gate, messaging gate,
 * recording consent + ingestion, 10-star ratings (both directions) with 10-form +
 * signature requirement, automated validation, and the manual review queue.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3333 node scripts/test-platform-flows.mjs
 */

const baseRaw = process.env.BASE_URL ?? "http://127.0.0.1:3333";
const base = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;

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

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}/api/platform${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const get = (p, o) => call("GET", p, o);
const post = (p, body, token) => call("POST", p, { body, token });

function rnd(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
}
const forms10 = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`q${i + 1}`, "yes"]));

async function main() {
  console.log(`\n=== Platform flow tests against ${base} ===\n`);

  // --- Auth -----------------------------------------------------------------
  const patient = { email: rnd("pt"), password: "StrongPass!123", name: "Test Patient", role: "PATIENT" };
  const patient2 = { email: rnd("pt2"), password: "StrongPass!123", name: "Other Patient", role: "PATIENT" };
  const doctor = {
    email: rnd("dr"), password: "StrongPass!123", name: "Test Doctor", role: "DOCTOR",
    specialty: "Cardiologist", regNo: "REG-TEST-1", experience: 7
  };

  const pReg = await post("/auth/register", patient);
  assert("register patient returns 201 + token", pReg.status === 201 && !!pReg.data.token, JSON.stringify(pReg.data));
  const dReg = await post("/auth/register", doctor);
  assert("register doctor returns 201 + token", dReg.status === 201 && !!dReg.data.token, JSON.stringify(dReg.data));
  const p2Reg = await post("/auth/register", patient2);
  assert("register second patient returns token", !!p2Reg.data.token, JSON.stringify(p2Reg.data));

  const pToken = pReg.data.token;
  const dToken = dReg.data.token;
  const p2Token = p2Reg.data.token;
  const doctorId = dReg.data.user?.id ?? dReg.data.userId;
  const patientId = pReg.data.user?.id ?? pReg.data.userId;

  const dup = await post("/auth/register", patient);
  assert("duplicate email registration rejected", dup.status === 400, `status=${dup.status}`);

  const badLogin = await post("/auth/login", { email: patient.email, password: "wrong" });
  assert("login with wrong password -> 401", badLogin.status === 401, `status=${badLogin.status}`);

  const goodLogin = await post("/auth/login", { email: patient.email, password: patient.password });
  assert("login with correct password -> token", !!goodLogin.data.token, JSON.stringify(goodLogin.data));

  const me = await get("/auth/me", { token: pToken });
  assert("/auth/me valid for fresh token", me.data.valid === true, JSON.stringify(me.data));

  const meNoToken = await get("/auth/me");
  assert("/auth/me without token -> 401", meNoToken.status === 401, `status=${meNoToken.status}`);

  // --- DigiLocker -----------------------------------------------------------
  const dl = await get("/doctors/digilocker/start", { token: dToken });
  // Either configured (200 + authUrl) or guarded (500 with config message).
  assert(
    "digilocker start is wired (configured or clearly guarded)",
    (dl.status === 200 && typeof dl.data.authUrl === "string") ||
      (dl.status >= 400 && /DigiLocker not configured/i.test(dl.data.error ?? "")),
    JSON.stringify(dl.data)
  );
  const dlAsPatient = await get("/doctors/digilocker/start", { token: pToken });
  assert("digilocker start blocked for patient", dlAsPatient.status === 403, `status=${dlAsPatient.status}`);

  const verStatus = await get("/doctors/verification-status", { token: dToken });
  assert("verification-status returns verified flag", typeof verStatus.data.verified === "boolean", JSON.stringify(verStatus.data));

  // --- Disease board --------------------------------------------------------
  const created = await post("/posts", { title: "Chest pain", body: "Intermittent chest pain after walking.", tags: ["cardiac"] }, pToken);
  assert("patient can create post", created.status === 201 && !!created.data.post?.id, JSON.stringify(created.data));
  const postId = created.data.post?.id;

  const docCreate = await post("/posts", { title: "x", body: "y" }, dToken);
  assert("doctor cannot create post (403)", docCreate.status === 403, `status=${docCreate.status}`);

  const boardDoctor = await get("/posts", { token: dToken });
  assert("doctor sees the patient post on board", (boardDoctor.data.posts ?? []).some((p) => p.id === postId), "post not visible to doctor");

  const boardOtherPatient = await get("/posts", { token: p2Token });
  assert("other patient cannot see someone else's post", !(boardOtherPatient.data.posts ?? []).some((p) => p.id === postId), "leak to other patient");

  const boardOwner = await get("/posts", { token: pToken });
  assert("author patient sees own post", (boardOwner.data.posts ?? []).some((p) => p.id === postId), "owner cannot see own post");

  // --- Comment + like -------------------------------------------------------
  const comment = await post(`/posts/${postId}/comment`, { body: "Adding more detail." }, pToken);
  assert("comment on post works", comment.status === 201 && !!comment.data.comment?.id, JSON.stringify(comment.data));

  const like1 = await post(`/posts/${postId}/like`, undefined, dToken);
  assert("like increments to 1", like1.data.liked === true && like1.data.likes === 1, JSON.stringify(like1.data));
  const like2 = await post(`/posts/${postId}/like`, undefined, dToken);
  assert("re-like toggles back to 0 (unlike)", like2.data.liked === false && like2.data.likes === 0, JSON.stringify(like2.data));

  // --- Consultation gating BEFORE doctor reply ------------------------------
  const earlyConsult = await post("/consultations/start", { otherUserId: doctorId, postId }, pToken);
  assert("consultation blocked before doctor replies", earlyConsult.status === 403, `status=${earlyConsult.status}`);

  // --- Doctor reply ---------------------------------------------------------
  const reply = await post(`/posts/${postId}/reply`, { body: "Please monitor BP and book an ECG." }, dToken);
  assert("doctor can reply to post", reply.status === 201 && !!reply.data.reply?.id, JSON.stringify(reply.data));

  const patientReply = await post(`/posts/${postId}/reply`, { body: "nope" }, pToken);
  assert("patient cannot reply as doctor (403)", patientReply.status === 403, `status=${patientReply.status}`);

  // --- Consultation request AFTER reply -------------------------------------
  const consult = await post("/consultations/start", { otherUserId: doctorId, postId, replyId: reply.data.reply.id }, pToken);
  assert("consultation can start after doctor reply", !!consult.data.consultation?.id, JSON.stringify(consult.data));
  const consultationId = consult.data.consultation?.id;
  assert("new consultation status is REQUESTED", consult.data.consultation?.status === "REQUESTED", consult.data.consultation?.status);

  // --- Messaging gate before approval ---------------------------------------
  const msgBefore = await post(`/consultations/${consultationId}/message`, { body: "Hello doctor" }, dToken);
  assert("doctor cannot message before approving", msgBefore.status === 403, `status=${msgBefore.status}`);

  // --- Doctor approval ------------------------------------------------------
  const patientApprove = await post(`/consultations/${consultationId}/respond`, { decision: "ACCEPT" }, pToken);
  assert("patient cannot approve consultation", patientApprove.status === 403, `status=${patientApprove.status}`);

  const approve = await post(`/consultations/${consultationId}/respond`, { decision: "ACCEPT" }, dToken);
  assert("doctor approves consultation -> ACTIVE", approve.data.consultation?.status === "ACTIVE", JSON.stringify(approve.data));

  const approveAgain = await post(`/consultations/${consultationId}/respond`, { decision: "REJECT" }, dToken);
  assert("cannot re-decide an already active consultation", approveAgain.status === 409, `status=${approveAgain.status}`);

  // --- Messaging after approval ---------------------------------------------
  const msgAfter1 = await post(`/consultations/${consultationId}/message`, { body: "Hello, here is my history in detail." }, dToken);
  assert("messaging works after approval", msgAfter1.status === 201, JSON.stringify(msgAfter1.data));
  await post(`/consultations/${consultationId}/message`, { body: "Thanks doctor, my BP was 140/90 this morning." }, pToken);
  await post(`/consultations/${consultationId}/message`, { body: "Noted. Continue medication and review in a week." }, dToken);

  // --- Recording consent + ingestion ----------------------------------------
  const recNoConsent = await post(`/consultations/${consultationId}/recording`, { provider: "test" }, dToken);
  assert("recording blocked before dual consent", recNoConsent.status === 400, `status=${recNoConsent.status}`);

  await post(`/consultations/${consultationId}/consent-recording`, {}, pToken);
  await post(`/consultations/${consultationId}/consent-recording`, {}, dToken);
  const rec = await post(`/consultations/${consultationId}/recording`, {
    provider: "test-provider",
    transcript: "Doctor discussed BP management and ECG follow up in a calm, professional manner over several minutes.",
    durationSeconds: 360
  }, dToken);
  assert("recording ingested after dual consent", rec.status === 201 && !!rec.data.recording?.id, JSON.stringify(rec.data));

  // --- Ratings: doctor rating by patient ------------------------------------
  const ratingNoForm = await post("/ratings/doctor", { consultationId, doctorId, score: 9, formAnswers: { q1: "yes" } }, pToken);
  assert("doctor rating rejected without 10 forms", ratingNoForm.status === 400, `status=${ratingNoForm.status}`);

  const ratingDoc = await post("/ratings/doctor", {
    consultationId, doctorId, score: 9, formAnswers: forms10, signature: "patient-sign"
  }, pToken);
  assert("doctor rating accepted with 10 forms + signature", ratingDoc.status === 201 && !!ratingDoc.data.ratingId, JSON.stringify(ratingDoc.data));
  assert("doctor rating auto-validation ran", !!ratingDoc.data.validation, JSON.stringify(ratingDoc.data));
  assert("approved rating (good evidence) is not flagged", ratingDoc.data.validation?.autoDecision === "APPROVED", JSON.stringify(ratingDoc.data.validation));

  const docRateAsDoctor = await post("/ratings/doctor", { consultationId, doctorId, score: 9, formAnswers: forms10 }, dToken);
  assert("doctor cannot submit a doctor-rating (403)", docRateAsDoctor.status === 403, `status=${docRateAsDoctor.status}`);

  // --- Ratings: patient rating by doctor ------------------------------------
  const ratingPat = await post("/ratings/patient", {
    consultationId, patientId, score: 8, formAnswers: forms10, signature: "doctor-sign"
  }, dToken);
  assert("patient rating accepted from doctor", ratingPat.status === 201 && !!ratingPat.data.ratingId, JSON.stringify(ratingPat.data));

  // --- 10-star aggregate visible --------------------------------------------
  const doctorsList = await get("/doctors", { token: pToken });
  const ratedDoctor = (doctorsList.data.doctors ?? []).find((d) => d.id === doctorId);
  assert("doctor appears in directory with 10-scale rating", !!ratedDoctor && ratedDoctor.ratingOutOf === 10, JSON.stringify(ratedDoctor));
  assert("doctor rating count reflects approved rating", (ratedDoctor?.ratingCount ?? 0) >= 1, JSON.stringify(ratedDoctor));

  const patientsList = await get("/patients", { token: dToken });
  const ratedPatient = (patientsList.data.patients ?? []).find((p) => p.id === patientId);
  assert("patient appears in directory with 10-scale rating", !!ratedPatient && ratedPatient.ratingOutOf === 10, JSON.stringify(ratedPatient));

  // --- DB persistence: reads reflect writes ---------------------------------
  // Re-like the post so we can positively confirm like persistence on reload.
  const reLike = await post(`/posts/${postId}/like`, undefined, dToken);
  assert("re-like sets like back to 1", reLike.data.liked === true && reLike.data.likes === 1, JSON.stringify(reLike.data));

  const boardAfter = await get("/posts", { token: dToken });
  const persistedPost = (boardAfter.data.posts ?? []).find((p) => p.id === postId);
  assert("persistence: post retrievable on fresh read", !!persistedPost, "post missing after reload");
  assert("persistence: comment survived round-trip", (persistedPost?.comments ?? []).some((c) => c.text === "Adding more detail."), JSON.stringify(persistedPost?.comments));
  assert("persistence: doctor reply survived round-trip", (persistedPost?.doctorReplies ?? []).some((r) => r.text === "Please monitor BP and book an ECG."), JSON.stringify(persistedPost?.doctorReplies));
  assert("persistence: like count persisted (1) with likedByMe", persistedPost?.likes === 1 && persistedPost?.likedByMe === true, JSON.stringify({ likes: persistedPost?.likes, likedByMe: persistedPost?.likedByMe }));

  const consultDetail = await get(`/consultations/${consultationId}`, { token: dToken });
  const cd = consultDetail.data.consultation;
  assert("persistence: consultation status ACTIVE on reload", cd?.status === "ACTIVE", JSON.stringify({ status: cd?.status }));
  assert("persistence: messages persisted (>=3)", (cd?.messages ?? []).length >= 3, `messages=${(cd?.messages ?? []).length}`);
  assert("persistence: recording persisted on consultation", (cd?.callRecordings ?? []).length >= 1, `recordings=${(cd?.callRecordings ?? []).length}`);
  assert("persistence: doctor rating persisted on consultation", (cd?.doctorRatings ?? []).length >= 1, `doctorRatings=${(cd?.doctorRatings ?? []).length}`);
  assert("persistence: patient rating persisted on consultation", (cd?.patientRatings ?? []).length >= 1, `patientRatings=${(cd?.patientRatings ?? []).length}`);
  assert("persistence: dual recording consent stored", cd?.patientConsentedRecording === true && cd?.doctorConsentedRecording === true, JSON.stringify({ p: cd?.patientConsentedRecording, d: cd?.doctorConsentedRecording }));

  const consultList = await get("/consultations", { token: pToken });
  const consultRow = (consultList.data.consultations ?? []).find((c) => c.id === consultationId);
  assert("persistence: consultation list reflects messageCount", (consultRow?.messageCount ?? 0) >= 3, JSON.stringify(consultRow));

  // --- Flagged rating path (weak evidence) ----------------------------------
  const c2 = await post("/posts", { title: "Headache", body: "Mild headache for two days." }, p2Token);
  const c2PostId = c2.data.post?.id;
  const r2 = await post(`/posts/${c2PostId}/reply`, { body: "Stay hydrated." }, dToken);
  const consult2 = await post("/consultations/start", { otherUserId: doctorId, postId: c2PostId, replyId: r2.data.reply.id }, p2Token);
  const consult2Id = consult2.data.consultation.id;
  await post(`/consultations/${consult2Id}/respond`, { decision: "ACCEPT" }, dToken);
  // No messages, no consent -> should flag.
  const flaggedRating = await post("/ratings/doctor", {
    consultationId: consult2Id, doctorId, score: 10, formAnswers: forms10, signature: "p2"
  }, p2Token);
  assert("thin-evidence rating gets FLAGGED by automation", flaggedRating.data.validation?.autoDecision === "FLAGGED", JSON.stringify(flaggedRating.data.validation));
  assert("flagged validation lists concrete flags", (flaggedRating.data.validation?.flags ?? []).length > 0, JSON.stringify(flaggedRating.data.validation));

  // --- Manual review queue --------------------------------------------------
  const queue = await get("/ratings/review-queue", { token: dToken });
  assert("review queue returns runs array", Array.isArray(queue.data.runs), JSON.stringify(queue.data));
  const queuePatient = await get("/ratings/review-queue", { token: pToken });
  assert("review queue blocked for patient", queuePatient.status === 403, `status=${queuePatient.status}`);

  // --- Unknown route --------------------------------------------------------
  const unknown = await get("/nope-not-real", { token: pToken });
  assert("unknown platform route -> 404", unknown.status === 404, `status=${unknown.status}`);

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
