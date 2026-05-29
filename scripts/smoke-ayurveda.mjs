/**
 * Smoke test: GET /api/ayurveda/yoga on a running server.
 * Usage: BASE_URL=https://your-app.onrender.com DISEASE=diabetes node scripts/smoke-ayurveda.mjs
 */
const raw = process.env.BASE_URL ?? process.env.SMOKE_URL ?? "http://127.0.0.1:3333";
const disease = process.env.DISEASE ?? "diabetes";
const url = new URL(`/api/ayurveda/yoga?disease=${encodeURIComponent(disease)}`, raw.endsWith("/") ? raw : `${raw}/`);

const res = await fetch(url, { headers: { Accept: "application/json" } });
const text = await res.text();

let body;
try {
  body = JSON.parse(text);
} catch {
  console.error("Non-JSON response", res.status, text.slice(0, 500));
  process.exit(1);
}

if (!res.ok || body?.ok !== true) {
  console.error("Ayurveda smoke failed", res.status, body);
  process.exit(1);
}

const summary = {
  ok: true,
  disease: body?.result?.diseaseSlug,
  asanas: Array.isArray(body?.result?.asanas) ? body.result.asanas.length : 0,
  pranayama: Array.isArray(body?.result?.pranayama) ? body.result.pranayama.length : 0,
  citations: Array.isArray(body?.result?.citations) ? body.result.citations.length : 0
};

console.log("OK", url.href, summary);

