import { createHash, randomBytes } from "node:crypto";

const DIGILOCKER_BASE = process.env.DIGILOCKER_BASE_URL?.trim() || "https://api.digitallocker.gov.in/public";
const DIGILOCKER_AUTH_URL =
  process.env.DIGILOCKER_AUTH_URL?.trim() || "https://api.digitallocker.gov.in/public/oauth2/1/authorize";
const DIGILOCKER_TOKEN_URL =
  process.env.DIGILOCKER_TOKEN_URL?.trim() || "https://api.digitallocker.gov.in/public/oauth2/1/token";

export type DigilockerProfile = {
  digilockerUserId?: string;
  documentUri?: string;
  documentName?: string;
  issuer?: string;
  rawMeta?: Record<string, unknown>;
};

export function ensureDigilockerConfigured() {
  const clientId = process.env.DIGILOCKER_CLIENT_ID?.trim();
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET?.trim();
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "DigiLocker not configured. Set DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET, DIGILOCKER_REDIRECT_URI."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function createDigilockerStartUrl(state?: string) {
  const { clientId, redirectUri } = ensureDigilockerConfigured();
  const st = state || randomBytes(16).toString("hex");
  const u = new URL(DIGILOCKER_AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", st);
  u.searchParams.set("scope", "openid profile issued-documents");
  return { url: u.toString(), state: st };
}

export async function exchangeDigilockerCode(code: string) {
  const { clientId, clientSecret, redirectUri } = ensureDigilockerConfigured();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });
  const res = await fetch(DIGILOCKER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const txt = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`DigiLocker token exchange failed (${res.status}): ${txt.slice(0, 300)}`);
  const data = JSON.parse(txt) as { access_token?: string };
  if (!data.access_token) throw new Error("DigiLocker token response missing access_token");
  return data.access_token;
}

async function digilockerGet(accessToken: string, path: string) {
  const u = new URL(path, DIGILOCKER_BASE.endsWith("/") ? DIGILOCKER_BASE : `${DIGILOCKER_BASE}/`);
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
  });
  const txt = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`DigiLocker API failed (${res.status}) for ${path}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt) as any;
}

/**
 * Conservative fetcher:
 * - tries profile endpoint
 * - tries documents endpoint
 * - does not fail if document list shape differs; caller can keep as pending.
 */
export async function fetchDigilockerDegreeCandidate(accessToken: string): Promise<DigilockerProfile> {
  let profile: any = {};
  let docs: any = {};
  try {
    profile = await digilockerGet(accessToken, "/api/user");
  } catch {
    profile = {};
  }
  try {
    docs = await digilockerGet(accessToken, "/api/issued");
  } catch {
    docs = {};
  }

  const list: any[] = Array.isArray(docs?.items)
    ? docs.items
    : Array.isArray(docs?.issued)
      ? docs.issued
      : Array.isArray(docs)
        ? docs
        : [];
  const degree = list.find((d) => /degree|medical|mbbs|md|ms|dm|mch/i.test(String(d?.name ?? d?.doctype ?? ""))) || list[0];
  const documentUri = degree?.uri || degree?.docUri || degree?.id || undefined;
  const documentName = degree?.name || degree?.doctype || undefined;
  const issuer = degree?.issuer || degree?.issuer_name || undefined;

  return {
    digilockerUserId: profile?.id || profile?.sub || profile?.userId || undefined,
    documentUri,
    documentName,
    issuer,
    rawMeta: { profile, docs }
  };
}

export function hashDigilockerDocumentId(value?: string) {
  if (!value) return undefined;
  return createHash("sha256").update(value).digest("hex");
}

