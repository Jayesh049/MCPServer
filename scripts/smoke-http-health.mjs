/**
 * Smoke test: GET /api/health on a running server.
 * Usage: BASE_URL=https://your-app.onrender.com node scripts/smoke-http-health.mjs
 */
const raw = process.env.BASE_URL ?? process.env.SMOKE_URL ?? "http://127.0.0.1:3333";
const url = new URL("/api/health", raw.endsWith("/") ? raw : `${raw}/`);

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
  console.error("Health check failed", res.status, body);
  process.exit(1);
}

console.log("OK", url.href, body);
