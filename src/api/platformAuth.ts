/**
 * Platform JWT — one server secret (JWT_SECRET), new token on each login/register.
 *
 * Architecture:
 * - JWT_SECRET: fixed env var on Render (never sent to browser). Used to sign/verify all tokens.
 * - On login/register: server issues a new JWT (expires in 7 days by default).
 * - On protected API calls: client sends `Authorization: Bearer <token>`; server verifies signature + expiry.
 */

import type { IncomingMessage } from "node:http";
import jwt, { type SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? process.env.PLATFORM_JWT_SECRET ?? "change-me-in-production";
const JWT_EXPIRES_IN: SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) ?? "7d";

export type PlatformJwtPayload = {
  /** Subject — platform user id */
  sub: string;
  userId: string;
  role: "DOCTOR" | "PATIENT";
  email: string;
  name: string;
};

export function isJwtSecretConfigured(): boolean {
  const s = process.env.JWT_SECRET ?? process.env.PLATFORM_JWT_SECRET;
  return Boolean(s && s.length >= 16 && s !== "change-me-in-production");
}

/** Issue a new JWT after successful login or register. */
/** Short-lived token between password/Google login and 2FA verification (10 min). */
export function signPending2faToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: "2fa" }, JWT_SECRET, { expiresIn: "10m" });
}

export function verifyPending2faToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token.trim(), JWT_SECRET) as { sub?: string; purpose?: string };
    if (decoded.purpose !== "2fa" || !decoded.sub) return null;
    return { userId: decoded.sub };
  } catch {
    return null;
  }
}

export type AuthSessionResult =
  | { step: "complete"; token: string; expiresIn: string; user: unknown }
  | { step: "2fa_required"; pendingToken: string; user: unknown };

export function signPlatformToken(user: {
  id: string;
  role: "DOCTOR" | "PATIENT";
  email: string;
  name: string;
}): { token: string; expiresIn: string } {
  const payload: PlatformJwtPayload = {
    sub: user.id,
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token, expiresIn: String(JWT_EXPIRES_IN ?? "7d") };
}

export type VerifyResult =
  | { ok: true; payload: PlatformJwtPayload }
  | { ok: false; error: string; code: "missing" | "expired" | "invalid" };

export function verifyPlatformToken(token: string): VerifyResult {
  if (!token?.trim()) {
    return { ok: false, error: "Token missing", code: "missing" };
  }
  try {
    const decoded = jwt.verify(token.trim(), JWT_SECRET) as PlatformJwtPayload & {
      userId?: string;
    };
    const userId = decoded.sub ?? decoded.userId;
    if (!userId || !decoded.role) {
      return { ok: false, error: "Invalid token payload", code: "invalid" };
    }
    return {
      ok: true,
      payload: {
        sub: userId,
        userId,
        role: decoded.role,
        email: decoded.email ?? "",
        name: decoded.name ?? "",
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid token";
    if (msg.toLowerCase().includes("expired")) {
      return { ok: false, error: "Token expired — please log in again", code: "expired" };
    }
    return { ok: false, error: "Invalid or tampered token", code: "invalid" };
  }
}

/** Read Bearer token from request and verify. */
export function verifyTokenFromRequest(req: IncomingMessage): VerifyResult {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return { ok: false, error: "Authorization header required (Bearer token)", code: "missing" };
  }
  return verifyPlatformToken(auth.slice(7));
}
