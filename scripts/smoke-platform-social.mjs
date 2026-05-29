/**
 * Smoke test for platform social workflow.
 * Starts from register/login APIs, creates patient post, doctor reply, consultation start, and doctor rating.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3333 node scripts/smoke-platform-social.mjs
 */
const baseRaw = process.env.BASE_URL ?? "http://127.0.0.1:3333";
const base = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;

async function post(path, body, token) {
  const res = await fetch(`${base}/api/platform${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} failed: ${data.error ?? res.statusText}`);
  return data;
}

async function get(path, token) {
  const res = await fetch(`${base}/api/platform${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} failed: ${data.error ?? res.statusText}`);
  return data;
}

function randEmail(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
}

const patient = {
  email: randEmail("pt"),
  password: "StrongPass!123",
  name: "Smoke Patient",
  role: "PATIENT"
};
const doctor = {
  email: randEmail("dr"),
  password: "StrongPass!123",
  name: "Smoke Doctor",
  role: "DOCTOR",
  specialty: "General Physician",
  regNo: "SMOKE-REG-001",
  experience: 5
};

const pReg = await post("/auth/register", patient);
const dReg = await post("/auth/register", doctor);
const pToken = pReg.token;
const dToken = dReg.token;
if (!pToken || !dToken) throw new Error("Registration did not return tokens");

const created = await post("/posts", { title: "Smoke post", body: "Need guidance", tags: ["smoke"] }, pToken);
const postId = created.post?.id;
if (!postId) throw new Error("Post creation returned no post id");

await post(`/posts/${postId}/reply`, { body: "Doctor response for smoke test" }, dToken);

const boardForPatient = await get("/posts", pToken);
const boardForDoctor = await get("/posts", dToken);

const consult = await post(
  "/consultations/start",
  {
    otherUserId: dReg.user?.id ?? dReg.userId,
    postId
  },
  pToken
);
const consultationId = consult.consultation?.id;
if (!consultationId) throw new Error("Consultation start returned no id");

await post(`/consultations/${consultationId}/consent-recording`, {}, pToken);
await post(`/consultations/${consultationId}/consent-recording`, {}, dToken);

await post(
  "/ratings/doctor",
  {
    consultationId,
    doctorId: dReg.user?.id ?? dReg.userId,
    score: 8,
    formAnswers: {
      q1: "yes",
      q2: "yes",
      q3: "yes",
      q4: "yes",
      q5: "yes",
      q6: "yes",
      q7: "yes",
      q8: "yes",
      q9: "yes",
      q10: "yes"
    },
    signature: "patient-signature-smoke"
  },
  pToken
);

console.log("OK", {
  patientPostsVisible: Array.isArray(boardForPatient.posts),
  doctorPostsVisible: Array.isArray(boardForDoctor.posts),
  consultationId
});

