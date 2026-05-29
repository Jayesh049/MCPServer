/** API client for /api/platform (proxied via next.config rewrites). */

const TOKEN_KEY = "platform_token";
const PENDING_KEY = "platform_pending_2fa";

export function getPlatformToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setPlatformToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearPlatformAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PENDING_KEY);
}

export function setPending2fa(token: string) {
  localStorage.setItem(PENDING_KEY, token);
}

export function getPending2fa(): string | null {
  return localStorage.getItem(PENDING_KEY);
}

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role: "DOCTOR" | "PATIENT";
  initials?: string;
  twoFactorEnabled?: boolean;
};

export type AuthResult =
  | { step: "complete"; token: string; user: PlatformUser; userId?: string; storedInDatabase?: boolean }
  | { step: "2fa_required"; pendingToken: string; user: PlatformUser }
  | { step: "needs_role"; email: string; name: string; googleId: string };

type ApiAuthPayload = {
  ok?: boolean;
  step?: string;
  token?: string;
  pendingToken?: string;
  user?: PlatformUser;
  userId?: string;
  storedInDatabase?: boolean;
  email?: string;
  name?: string;
  googleId?: string;
  error?: string;
};

/** Map API JSON to a typed auth result (register/login save rows in Postgres). */
export function normalizeAuthResult(data: ApiAuthPayload): AuthResult {
  if (data.step === "needs_role" && data.email && data.googleId) {
    return {
      step: "needs_role",
      email: data.email,
      name: data.name ?? data.email,
      googleId: data.googleId
    };
  }
  if (data.step === "2fa_required" && data.pendingToken && data.user) {
    return { step: "2fa_required", pendingToken: data.pendingToken, user: data.user };
  }
  if (data.token && data.user) {
    return {
      step: "complete",
      token: data.token,
      user: data.user,
      userId: data.userId ?? data.user.id,
      storedInDatabase: data.storedInDatabase ?? true
    };
  }
  throw new Error(data.error ?? "Unexpected auth response");
}

async function platformFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/platform${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data;
}

export async function loginEmail(email: string, password: string): Promise<ApiAuthPayload> {
  return platformFetch<ApiAuthPayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(body: Record<string, unknown>): Promise<ApiAuthPayload> {
  return platformFetch<ApiAuthPayload>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function loginGoogle(
  idToken: string,
  role?: "DOCTOR" | "PATIENT",
  extra?: Record<string, unknown>
): Promise<ApiAuthPayload> {
  return platformFetch<ApiAuthPayload>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken, role, ...extra }),
  });
}

export async function verify2fa(pendingToken: string, code: string): Promise<ApiAuthPayload> {
  return platformFetch<ApiAuthPayload>("/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ pendingToken, code }),
  });
}

export async function fetchMe(token: string): Promise<{ user: PlatformUser }> {
  return platformFetch("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function completeAuth(result: AuthResult): void {
  if (result.step === "complete") {
    setPlatformToken(result.token);
    if (result.userId) sessionStorage.setItem("platform_user_id", result.userId);
    window.location.href = "/platform";
  } else if (result.step === "2fa_required") {
    setPending2fa(result.pendingToken);
    window.location.href = "/verify-2fa";
  }
}

export async function digilockerStart(token: string): Promise<{ authUrl: string; state: string }> {
  return platformFetch("/doctors/digilocker/start", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function digilockerStatus(token: string): Promise<{
  verified: boolean;
  verifications: unknown[];
}> {
  return platformFetch("/doctors/verification-status", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getConsultations(token: string) {
  return platformFetch("/consultations", {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function getConsultationById(token: string, consultationId: string) {
  return platformFetch(`/consultations/${consultationId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function respondConsultation(
  token: string,
  consultationId: string,
  decision: "ACCEPT" | "REJECT"
) {
  return platformFetch(`/consultations/${consultationId}/respond`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ decision })
  });
}

export async function submitDoctorRating(
  token: string,
  payload: {
    consultationId: string;
    doctorId: string;
    score: number;
    formAnswers: Record<string, unknown>;
    signature?: string;
  }
) {
  return platformFetch("/ratings/doctor", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export async function submitPatientRating(
  token: string,
  payload: {
    consultationId: string;
    patientId: string;
    score: number;
    formAnswers: Record<string, unknown>;
    signature?: string;
  }
) {
  return platformFetch("/ratings/patient", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}
