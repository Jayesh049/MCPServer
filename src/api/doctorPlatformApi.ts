/**
 * Doctor & Patient Platform API — `/api/platform/*`
 * Auth, disease board, consultations, tips (educational demo only).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import {
  isJwtSecretConfigured,
  signPending2faToken,
  signPlatformToken,
  verifyPending2faToken,
  verifyPlatformToken,
  verifyTokenFromRequest,
} from "./platformAuth.js";
import { generateTotpSecret, totpQrDataUrl, totpOtpauthUrl, verifyTotpCode } from "./platform2fa.js";
import { verifyGoogleIdToken } from "./platformGoogleAuth.js";
import { randomBytes } from "node:crypto";
import {
  createDigilockerStartUrl,
  exchangeDigilockerCode,
  fetchDigilockerDegreeCandidate,
  hashDigilockerDocumentId
} from "./digilocker.js";
import { runRatingValidation } from "../rating/validation.js";

const SALT_ROUNDS = 10;
const digilockerStateToUser = new Map<string, string>();

type PatientProfileFields = {
  age: number | null;
  bloodGroup: string | null;
  city: string | null;
  languages: string | null;
  medications: string | null;
  conditions: string[];
  allergies: string[];
};

/** Save patient row — raw SQL fallback if Prisma client was not regenerated after migration. */
async function persistPatientProfile(userId: string, fields: PatientProfileFields): Promise<void> {
  const existing = await prisma.platformPatient.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!existing) {
    await prisma.platformPatient.create({
      data: {
        userId,
        conditions: fields.conditions,
        allergies: fields.allergies,
      },
    });
  }

  try {
    await prisma.platformPatient.update({
      where: { userId },
      data: {
        age: fields.age,
        bloodGroup: fields.bloodGroup,
        city: fields.city,
        languages: fields.languages,
        medications: fields.medications,
        conditions: fields.conditions,
        allergies: fields.allergies,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("Unknown argument") && !msg.includes("languages")) {
      throw e;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "PlatformPatient"
       SET age = $1,
           "bloodGroup" = $2,
           city = $3,
           languages = $4,
           medications = $5,
           conditions = $6::text[],
           allergies = $7::text[]
       WHERE "userId" = $8`,
      fields.age,
      fields.bloodGroup,
      fields.city,
      fields.languages,
      fields.medications,
      fields.conditions,
      fields.allergies,
      userId
    );
  }
}

function setCors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  setCors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody<T = unknown>(req: IncomingMessage): Promise<T | null> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Protected routes: verify JWT from Authorization header. */
function requireAuth(
  req: IncomingMessage,
  res: ServerResponse
): { userId: string; role: "DOCTOR" | "PATIENT" } | null {
  const result = verifyTokenFromRequest(req);
  if (result.ok) {
    return { userId: result.payload.userId, role: result.payload.role };
  }
  sendJson(res, 401, { ok: false, error: result.error, code: result.code });
  return null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function safeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash?: string;
  twoFactorEnabled?: boolean;
  doctor?: unknown;
  patient?: unknown;
  createdAt?: Date;
}) {
  const { passwordHash: _p, totpSecret: _t, ...rest } = user as typeof user & { totpSecret?: string };
  return {
    ...rest,
    initials: initials(user.name),
    twoFactorEnabled: user.twoFactorEnabled ?? false,
  };
}

type PlatformUserRow = {
  id: string;
  email: string;
  name: string;
  role: "DOCTOR" | "PATIENT";
  passwordHash: string;
  twoFactorEnabled: boolean;
  totpSecret: string | null;
  doctor?: unknown;
  patient?: unknown;
};

function issueAuthResponse(res: ServerResponse, status: number, user: PlatformUserRow) {
  const safe = safeUser(user);
  if (user.twoFactorEnabled && user.totpSecret) {
    sendJson(res, status, {
      ok: true,
      step: "2fa_required",
      pendingToken: signPending2faToken(user.id),
      user: safe,
    });
    return;
  }
  const { token, expiresIn } = signPlatformToken(user);
  sendJson(res, status, {
    ok: true,
    step: "complete",
    token,
    tokenType: "Bearer",
    expiresIn,
    user: safe,
    userId: user.id,
    storedInDatabase: true,
    ...(isJwtSecretConfigured() ? {} : { warning: "Set JWT_SECRET on the server in production" }),
  });
}

function formatPost(
  post: {
  id: string;
  title: string;
  body: string;
  tags: string[];
  views: number;
  createdAt: Date;
  author: { name: string };
  replies: Array<{
    id: string;
    body: string;
    createdAt: Date;
    doctor: { id: string; name: string; doctor?: { specialty: string | null } | null };
  }>;
  comments?: Array<{
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; name: string; role: "DOCTOR" | "PATIENT" };
  }>;
  likes?: Array<{ userId: string }>;
  },
  viewerUserId?: string
) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    tags: post.tags,
    views: post.views,
    time: post.createdAt.toISOString(),
    author: post.author.name,
    replies: post.replies.length,
    likes: post.likes?.length ?? 0,
    likedByMe: viewerUserId ? (post.likes?.some((l) => l.userId === viewerUserId) ?? false) : false,
    comments: post.comments?.map((c) => ({
      id: c.id,
      authorId: c.author.id,
      author: c.author.name,
      role: c.author.role.toLowerCase(),
      initials: initials(c.author.name),
      text: c.body,
      time: c.createdAt.toLocaleString()
    })) ?? [],
    doctorReplies: post.replies.map((r) => ({
      id: r.id,
      doctorId: r.doctor.id,
      doctor: r.doctor.name,
      specialty: r.doctor.doctor?.specialty ?? "Physician",
      initials: initials(r.doctor.name),
      text: r.body,
      time: r.createdAt.toLocaleString(),
    })),
  };
}

export async function handleDoctorPlatformRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  if (!req.url) return false;
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/platform")) return false;

  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    return true;
  }

  const path = url.pathname.replace("/api/platform", "");

  try {
    // ── POST /auth/register ─────────────────────────────────────────────
    if (req.method === "POST" && path === "/auth/register") {
      const body = await readBody<{
        email: string;
        password: string;
        name: string;
        role: "DOCTOR" | "PATIENT";
        specialty?: string;
        regNo?: string;
        hospital?: string;
        experience?: number;
      }>(req);

      if (!body?.email || !body.password || !body.name || !body.role) {
        sendJson(res, 400, { ok: false, error: "email, password, name, role required" });
        return true;
      }

      const existing = await prisma.platformUser.findUnique({ where: { email: body.email } });
      if (existing) {
        sendJson(res, 400, { ok: false, error: "Email already registered" });
        return true;
      }

      const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
      const user = await prisma.platformUser.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name,
          role: body.role,
          ...(body.role === "DOCTOR"
            ? {
                doctor: {
                  create: {
                    specialty: body.specialty ?? "General Physician",
                    regNo: body.regNo ?? "",
                    hospital: body.hospital,
                    experience: body.experience ?? 0,
                    verified: false,
                  },
                },
              }
            : { patient: { create: {} } }),
        },
        include: { doctor: true, patient: true },
      });

      issueAuthResponse(res, 201, user);
      return true;
    }

    // ── POST /auth/login ────────────────────────────────────────────────
    if (req.method === "POST" && path === "/auth/login") {
      const body = await readBody<{ email: string; password: string }>(req);
      if (!body?.email || !body.password) {
        sendJson(res, 400, { ok: false, error: "email and password required" });
        return true;
      }

      const user = await prisma.platformUser.findUnique({
        where: { email: body.email },
        include: { doctor: true, patient: true },
      });

      if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
        sendJson(res, 401, { ok: false, error: "Invalid credentials" });
        return true;
      }

      issueAuthResponse(res, 200, user);
      return true;
    }

    // ── POST /auth/google — Google Sign-In (ID token from client) ─────
    if (req.method === "POST" && path === "/auth/google") {
      const body = await readBody<{
        idToken: string;
        role?: "DOCTOR" | "PATIENT";
        specialty?: string;
        regNo?: string;
      }>(req);
      if (!body?.idToken) {
        sendJson(res, 400, { ok: false, error: "idToken required" });
        return true;
      }

      const profile = await verifyGoogleIdToken(body.idToken);
      if (!profile) {
        sendJson(res, 401, { ok: false, error: "Invalid Google token" });
        return true;
      }

      let user = await prisma.platformUser.findFirst({
        where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
        include: { doctor: true, patient: true },
      });

      if (!user) {
        const role = body.role ?? "PATIENT";
        if (!body.role) {
          sendJson(res, 200, {
            ok: true,
            step: "needs_role",
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
          });
          return true;
        }
        const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
        user = await prisma.platformUser.create({
          data: {
            email: profile.email,
            name: profile.name,
            passwordHash,
            role,
            googleId: profile.googleId,
            ...(role === "DOCTOR"
              ? {
                  doctor: {
                    create: {
                      specialty: body.specialty ?? "General Physician",
                      regNo: body.regNo ?? "GOOGLE",
                      experience: 0,
                    },
                  },
                }
              : { patient: { create: {} } }),
          },
          include: { doctor: true, patient: true },
        });
      } else if (!user.googleId) {
        user = await prisma.platformUser.update({
          where: { id: user.id },
          data: { googleId: profile.googleId },
          include: { doctor: true, patient: true },
        });
      }

      issueAuthResponse(res, 200, user);
      return true;
    }

    // ── POST /auth/2fa/verify — complete login after TOTP ─────────────
    if (req.method === "POST" && path === "/auth/2fa/verify") {
      const body = await readBody<{ pendingToken: string; code: string }>(req);
      if (!body?.pendingToken || !body.code) {
        sendJson(res, 400, { ok: false, error: "pendingToken and code required" });
        return true;
      }
      const pending = verifyPending2faToken(body.pendingToken);
      if (!pending) {
        sendJson(res, 401, { ok: false, error: "2FA session expired — log in again" });
        return true;
      }
      const user = await prisma.platformUser.findUnique({
        where: { id: pending.userId },
        include: { doctor: true, patient: true },
      });
      if (!user?.totpSecret || !verifyTotpCode(user.totpSecret, body.code)) {
        sendJson(res, 401, { ok: false, error: "Invalid verification code" });
        return true;
      }
      const { token, expiresIn } = signPlatformToken(user);
      sendJson(res, 200, {
        ok: true,
        step: "complete",
        token,
        tokenType: "Bearer",
        expiresIn,
        user: safeUser(user),
        userId: user.id,
        storedInDatabase: true,
      });
      return true;
    }

    // ── POST /auth/2fa/setup — start 2FA enrollment (authenticated) ───
    if (req.method === "POST" && path === "/auth/2fa/setup") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const secret = generateTotpSecret();
      await prisma.platformUser.update({
        where: { id: auth.userId },
        data: { totpSecret: secret, twoFactorEnabled: false },
      });
      const user = await prisma.platformUser.findUnique({ where: { id: auth.userId } });
      const otpauthUrl = totpOtpauthUrl(user!.email, secret);
      const qrDataUrl = await totpQrDataUrl(otpauthUrl);
      sendJson(res, 200, {
        ok: true,
        secret,
        otpauthUrl,
        qrDataUrl,
        message: "Scan QR in Google Authenticator, then POST /auth/2fa/enable with a code",
      });
      return true;
    }

    // ── POST /auth/2fa/enable — confirm 2FA with valid code ───────────
    if (req.method === "POST" && path === "/auth/2fa/enable") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const body = await readBody<{ code: string }>(req);
      if (!body?.code) {
        sendJson(res, 400, { ok: false, error: "code required" });
        return true;
      }
      const user = await prisma.platformUser.findUnique({ where: { id: auth.userId } });
      if (!user?.totpSecret || !verifyTotpCode(user.totpSecret, body.code)) {
        sendJson(res, 400, { ok: false, error: "Invalid code — try again" });
        return true;
      }
      await prisma.platformUser.update({
        where: { id: auth.userId },
        data: { twoFactorEnabled: true },
      });
      sendJson(res, 200, { ok: true, twoFactorEnabled: true });
      return true;
    }

    // ── GET /auth/me — verify JWT + return current user from DB ───────
    if (req.method === "GET" && path === "/auth/me") {
      const verified = verifyTokenFromRequest(req);
      if (!verified.ok) {
        sendJson(res, 401, { ok: false, error: verified.error, code: verified.code });
        return true;
      }
      const user = await prisma.platformUser.findUnique({
        where: { id: verified.payload.userId },
        include: { doctor: true, patient: true },
      });
      if (!user) {
        sendJson(res, 401, { ok: false, error: "User no longer exists" });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        valid: true,
        user: safeUser(user),
        claims: verified.payload,
      });
      return true;
    }

    // ── POST /auth/verify — verify token (body or header) ─────────────
    if (req.method === "POST" && path === "/auth/verify") {
      const body = await readBody<{ token?: string }>(req);
      const headerResult = verifyTokenFromRequest(req);
      const token =
        body?.token?.trim() ||
        (headerResult.ok ? req.headers.authorization?.slice(7) : undefined);
      if (!token) {
        sendJson(res, 400, { ok: false, error: "token required in body or Authorization header" });
        return true;
      }
      const verified = verifyPlatformToken(token);
      if (!verified.ok) {
        sendJson(res, 401, { ok: false, valid: false, error: verified.error, code: verified.code });
        return true;
      }
      sendJson(res, 200, { ok: true, valid: true, claims: verified.payload });
      return true;
    }

    // ── GET /doctors ──────────────────────────────────────────────────
    if (req.method === "GET" && path === "/doctors") {
      const doctors = await prisma.platformUser.findMany({
        where: { role: "DOCTOR" },
        include: { doctor: true },
        take: 30,
        orderBy: { createdAt: "desc" },
      });
      sendJson(res, 200, {
        ok: true,
        doctors: await Promise.all(
          doctors.map(async (u) => {
            const agg = await prisma.doctorRating.aggregate({
              where: { doctorId: u.id, status: "APPROVED" },
              _avg: { score: true },
              _count: { score: true }
            });
            return {
              id: u.id,
              name: u.name,
              initials: initials(u.name),
              specialty: u.doctor?.specialty ?? "Physician",
              hospital: u.doctor?.hospital ?? "—",
              exp: `${u.doctor?.experience ?? 0} yrs`,
              rating: ((agg._avg.score ?? u.doctor?.rating ?? 0) / 1).toFixed(1),
              ratingOutOf: 10,
              ratingCount: agg._count.score ?? 0,
              consults: u.doctor?.totalConsults ?? 0,
              status: (u.doctor?.status ?? "ONLINE").toLowerCase(),
              verified: u.doctor?.verified ?? false,
            };
          })
        ),
      });
      return true;
    }

    // ── GET /patients ─────────────────────────────────────────────────
    if (req.method === "GET" && path === "/patients") {
      const patients = await prisma.platformUser.findMany({
        where: { role: "PATIENT" },
        include: { patient: true },
        take: 30,
        orderBy: { createdAt: "desc" },
      });
      sendJson(res, 200, {
        ok: true,
        patients: await Promise.all(
          patients.map(async (u) => {
            const agg = await prisma.patientRating.aggregate({
              where: { patientId: u.id, status: "APPROVED" },
              _avg: { score: true },
              _count: { score: true }
            });
            return {
              id: u.id,
              name: u.name,
              initials: initials(u.name),
              condition: u.patient?.conditions?.join(" · ") || "General consultation",
              age: u.patient?.age ? `${u.patient.age}` : "—",
              city: u.patient?.city ?? "—",
              status: "Active",
              rating: (agg._avg.score ?? 0).toFixed(1),
              ratingOutOf: 10,
              ratingCount: agg._count.score ?? 0
            };
          })
        ),
      });
      return true;
    }

    // ── GET /posts ────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/posts") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const posts = await prisma.diseasePost.findMany({
        // Doctors can review every patient post; a patient only sees their own threads.
        where:
          auth.role === "DOCTOR"
            ? {}
            : { authorId: auth.userId },
        include: {
          author: { select: { name: true } },
          replies: {
            include: { doctor: { select: { id: true, name: true, doctor: { select: { specialty: true } } } } },
            orderBy: { createdAt: "asc" },
          },
          comments: {
            include: { author: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" }
          },
          likes: { select: { userId: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      });
      sendJson(res, 200, { ok: true, posts: posts.map((p) => formatPost(p, auth.userId)) });
      return true;
    }

    // ── POST /posts ───────────────────────────────────────────────────
    if (req.method === "POST" && path === "/posts") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "PATIENT") {
        sendJson(res, 403, { ok: false, error: "Only patients can create board posts" });
        return true;
      }

      const body = await readBody<{ title: string; body: string; tags?: string[] }>(req);
      if (!body?.title || !body.body) {
        sendJson(res, 400, { ok: false, error: "title and body required" });
        return true;
      }

      const post = await prisma.diseasePost.create({
        data: {
          title: body.title,
          body: body.body,
          tags: body.tags ?? [],
          visibility: "DOCTORS_ONLY",
          authorId: auth.userId,
        },
        include: {
          author: { select: { name: true } },
          replies: {
            include: { doctor: { select: { id: true, name: true, doctor: { select: { specialty: true } } } } },
          },
          comments: {
            include: { author: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" }
          },
          likes: { select: { userId: true } }
        },
      });

      sendJson(res, 201, { ok: true, post: formatPost(post) });
      return true;
    }

    // ── POST /posts/:id/comment ───────────────────────────────────────
    const commentMatch = path.match(/^\/posts\/([^/]+)\/comment$/);
    if (req.method === "POST" && commentMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const postId = commentMatch[1]!;
      const body = await readBody<{ body: string }>(req);
      if (!body?.body?.trim()) {
        sendJson(res, 400, { ok: false, error: "comment body required" });
        return true;
      }
      const comment = await prisma.postComment.create({
        data: { postId, authorId: auth.userId, body: body.body.trim() },
        include: { author: { select: { id: true, name: true, role: true } } }
      });
      sendJson(res, 201, {
        ok: true,
        comment: {
          id: comment.id,
          authorId: comment.author.id,
          author: comment.author.name,
          role: comment.author.role.toLowerCase(),
          initials: initials(comment.author.name),
          text: comment.body,
          time: comment.createdAt.toLocaleString()
        }
      });
      return true;
    }

    // ── POST /posts/:id/like ──────────────────────────────────────────
    const likeMatch = path.match(/^\/posts\/([^/]+)\/like$/);
    if (req.method === "POST" && likeMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const postId = likeMatch[1]!;
      const existing = await prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId: auth.userId } }
      });
      if (existing) {
        await prisma.postLike.delete({ where: { id: existing.id } });
      } else {
        await prisma.postLike.create({ data: { postId, userId: auth.userId } });
      }
      const likes = await prisma.postLike.count({ where: { postId } });
      sendJson(res, 200, { ok: true, liked: !existing, likes });
      return true;
    }

    // ── POST /posts/:id/reply ─────────────────────────────────────────
    const replyMatch = path.match(/^\/posts\/([^/]+)\/reply$/);
    if (req.method === "POST" && replyMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Only doctors can reply" });
        return true;
      }

      const postId = replyMatch[1]!;
      const body = await readBody<{ body: string }>(req);
      if (!body?.body?.trim()) {
        sendJson(res, 400, { ok: false, error: "body required" });
        return true;
      }

      const reply = await prisma.doctorReply.create({
        data: { postId, doctorId: auth.userId, body: body.body.trim() },
        include: { doctor: { select: { name: true, doctor: { select: { specialty: true } } } } },
      });

      await prisma.platformDoctor.updateMany({
        where: { userId: auth.userId },
        data: { totalConsults: { increment: 1 } },
      });

      sendJson(res, 201, {
        ok: true,
        reply: {
          id: reply.id,
          doctorId: reply.doctorId,
          doctor: reply.doctor.name,
          specialty: reply.doctor.doctor?.specialty ?? "Physician",
          initials: initials(reply.doctor.name),
          text: reply.body,
          time: reply.createdAt.toLocaleString(),
        },
      });
      return true;
    }

    // ── POST /tips ────────────────────────────────────────────────────
    if (req.method === "POST" && path === "/tips") {
      const auth = requireAuth(req, res);
      if (!auth) return true;

      const body = await readBody<{
        receiverId: string;
        amount: number;
        replyId?: string;
        note?: string;
      }>(req);
      if (!body?.receiverId || !body.amount || body.amount < 1) {
        sendJson(res, 400, { ok: false, error: "receiverId and amount (>=1) required" });
        return true;
      }

      const tip = await prisma.platformTip.create({
        data: {
          giverId: auth.userId,
          receiverId: body.receiverId,
          amount: Math.floor(body.amount),
          replyId: body.replyId,
          note: body.note,
        },
      });

      sendJson(res, 201, { ok: true, tip });
      return true;
    }

    // ── GET /tips/received ────────────────────────────────────────────
    if (req.method === "GET" && path === "/tips/received") {
      const auth = requireAuth(req, res);
      if (!auth) return true;

      const tips = await prisma.platformTip.findMany({
        where: { receiverId: auth.userId },
        include: { giver: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const total = tips.reduce((s, t) => s + t.amount, 0);
      sendJson(res, 200, {
        ok: true,
        tips: tips.map((t) => ({
          id: t.id,
          patient: t.giver.name,
          initials: initials(t.giver.name),
          amount: `₹${t.amount}`,
          type: t.note ?? "Tip",
          time: t.createdAt.toLocaleString(),
        })),
        total,
      });
      return true;
    }

    // ── POST /consultations/start ─────────────────────────────────────
    if (req.method === "POST" && path === "/consultations/start") {
      const auth = requireAuth(req, res);
      if (!auth) return true;

      const body = await readBody<{ otherUserId: string; postId?: string; replyId?: string }>(req);
      if (!body?.otherUserId) {
        sendJson(res, 400, { ok: false, error: "otherUserId required" });
        return true;
      }

      if (auth.role === "PATIENT") {
        const other = await prisma.platformUser.findUnique({
          where: { id: body.otherUserId },
          select: { role: true }
        });
        if (other?.role !== "DOCTOR") {
          sendJson(res, 403, { ok: false, error: "Patient can start consultation only with a doctor." });
          return true;
        }
        const allowedReply = await prisma.doctorReply.findFirst({
          where: {
            doctorId: body.otherUserId,
            ...(body.postId ? { postId: body.postId } : {}),
            post: { authorId: auth.userId }
          },
          select: { id: true, postId: true }
        });
        if (!allowedReply) {
          sendJson(res, 403, {
            ok: false,
            error: "Consultation can start after the doctor replies to your post."
          });
          return true;
        }
      }

      let consult = await prisma.consultation.findFirst({
        where: {
          OR: [
            { user1Id: auth.userId, user2Id: body.otherUserId },
            { user1Id: body.otherUserId, user2Id: auth.userId },
          ],
        },
        include: {
          messages: { orderBy: { sentAt: "asc" }, take: 80 },
          user1: { select: { id: true, name: true, role: true, doctor: true, patient: true } },
          user2: { select: { id: true, name: true, role: true, doctor: true, patient: true } },
        },
      });

      if (!consult) {
        consult = await prisma.consultation.create({
          data: {
            user1Id: auth.userId,
            user2Id: body.otherUserId,
            status: "REQUESTED",
            requestedById: auth.userId,
            requestPostId: body.postId,
            requestReplyId: body.replyId
          },
          include: {
            messages: true,
            user1: { select: { id: true, name: true, role: true, doctor: true, patient: true } },
            user2: { select: { id: true, name: true, role: true, doctor: true, patient: true } },
          },
        });
      }

      sendJson(res, 200, { ok: true, consultation: consult });
      return true;
    }

    // ── POST /consultations/:id/message ───────────────────────────────
    const msgMatch = path.match(/^\/consultations\/([^/]+)\/message$/);
    if (req.method === "POST" && msgMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;

      const consultationId = msgMatch[1]!;
      const body = await readBody<{ body: string }>(req);
      if (!body?.body?.trim()) {
        sendJson(res, 400, { ok: false, error: "message body required" });
        return true;
      }

      const consult = await prisma.consultation.findFirst({
        where: { id: consultationId, OR: [{ user1Id: auth.userId }, { user2Id: auth.userId }] }
      });
      if (!consult) {
        sendJson(res, 404, { ok: false, error: "Consultation not found" });
        return true;
      }
      if (consult.status === "REJECTED" || consult.status === "CLOSED") {
        sendJson(res, 403, { ok: false, error: `Consultation is ${consult.status.toLowerCase()}.` });
        return true;
      }
      if (consult.status === "REQUESTED" && auth.userId !== consult.requestedById) {
        sendJson(res, 403, {
          ok: false,
          error: "Doctor must approve this consultation before replying."
        });
        return true;
      }

      const message = await prisma.consultMessage.create({
        data: {
          consultationId,
          senderId: auth.userId,
          body: body.body.trim(),
        },
      });

      sendJson(res, 201, { ok: true, message });
      return true;
    }

    // ── POST /consultations/:id/respond — doctor approves/rejects request ──
    const respondMatch = path.match(/^\/consultations\/([^/]+)\/respond$/);
    if (req.method === "POST" && respondMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Only the doctor can approve/decline a consultation." });
        return true;
      }
      const consultationId = respondMatch[1]!;
      const body = await readBody<{ decision: "ACCEPT" | "REJECT" }>(req);
      const decision = body?.decision;
      if (decision !== "ACCEPT" && decision !== "REJECT") {
        sendJson(res, 400, { ok: false, error: 'decision must be "ACCEPT" or "REJECT".' });
        return true;
      }
      const consult = await prisma.consultation.findFirst({
        where: { id: consultationId, OR: [{ user1Id: auth.userId }, { user2Id: auth.userId }] }
      });
      if (!consult) {
        sendJson(res, 404, { ok: false, error: "Consultation not found" });
        return true;
      }
      if (consult.requestedById === auth.userId) {
        sendJson(res, 403, { ok: false, error: "Requester cannot approve their own consultation." });
        return true;
      }
      if (consult.status !== "REQUESTED") {
        sendJson(res, 409, { ok: false, error: `Consultation already ${consult.status.toLowerCase()}.` });
        return true;
      }
      const updated = await prisma.consultation.update({
        where: { id: consultationId },
        data: { status: decision === "ACCEPT" ? "ACTIVE" : "REJECTED" }
      });
      sendJson(res, 200, { ok: true, consultation: updated });
      return true;
    }

    // ── GET /consultations ────────────────────────────────────────────────
    if (req.method === "GET" && path === "/consultations") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const rows = await prisma.consultation.findMany({
        where: { OR: [{ user1Id: auth.userId }, { user2Id: auth.userId }] },
        include: {
          user1: { select: { id: true, name: true, role: true, doctor: true } },
          user2: { select: { id: true, name: true, role: true, doctor: true } },
          _count: { select: { messages: true, doctorRatings: true, patientRatings: true } }
        },
        orderBy: { updatedAt: "desc" },
        take: 100
      });
      sendJson(res, 200, {
        ok: true,
        consultations: rows.map((r) => ({
          id: r.id,
          status: r.status,
          startedAt: r.startedAt,
          updatedAt: r.updatedAt,
          patientConsentedRecording: r.patientConsentedRecording,
          doctorConsentedRecording: r.doctorConsentedRecording,
          participants: [r.user1, r.user2],
          messageCount: r._count.messages,
          doctorRatingCount: r._count.doctorRatings,
          patientRatingCount: r._count.patientRatings
        }))
      });
      return true;
    }

    // ── GET /consultations/:id ────────────────────────────────────────────
    const consultGetMatch = path.match(/^\/consultations\/([^/]+)$/);
    if (req.method === "GET" && consultGetMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const consultationId = consultGetMatch[1]!;
      const consult = await prisma.consultation.findFirst({
        where: {
          id: consultationId,
          OR: [{ user1Id: auth.userId }, { user2Id: auth.userId }]
        },
        include: {
          user1: { select: { id: true, name: true, role: true, doctor: true, patient: true } },
          user2: { select: { id: true, name: true, role: true, doctor: true, patient: true } },
          messages: { orderBy: { sentAt: "asc" }, take: 500 },
          callRecordings: { orderBy: { createdAt: "desc" }, take: 50 },
          doctorRatings: { orderBy: { createdAt: "desc" } },
          patientRatings: { orderBy: { createdAt: "desc" } }
        }
      });
      if (!consult) {
        sendJson(res, 404, { ok: false, error: "Consultation not found" });
        return true;
      }
      sendJson(res, 200, { ok: true, consultation: consult });
      return true;
    }

    // ── POST /consultations/:id/consent-recording ────────────────────────
    const consentMatch = path.match(/^\/consultations\/([^/]+)\/consent-recording$/);
    if (req.method === "POST" && consentMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const consultationId = consentMatch[1]!;
      const consult = await prisma.consultation.findFirst({
        where: { id: consultationId, OR: [{ user1Id: auth.userId }, { user2Id: auth.userId }] }
      });
      if (!consult) {
        sendJson(res, 404, { ok: false, error: "Consultation not found" });
        return true;
      }
      const data =
        auth.role === "PATIENT"
          ? { patientConsentedRecording: true }
          : { doctorConsentedRecording: true };
      const updated = await prisma.consultation.update({ where: { id: consultationId }, data });
      sendJson(res, 200, { ok: true, consultation: updated });
      return true;
    }

    // ── POST /consultations/:id/recording ────────────────────────────────
    const recMatch = path.match(/^\/consultations\/([^/]+)\/recording$/);
    if (req.method === "POST" && recMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      const consultationId = recMatch[1]!;
      const consult = await prisma.consultation.findFirst({
        where: { id: consultationId, OR: [{ user1Id: auth.userId }, { user2Id: auth.userId }] }
      });
      if (!consult) {
        sendJson(res, 404, { ok: false, error: "Consultation not found" });
        return true;
      }
      if (!consult.patientConsentedRecording || !consult.doctorConsentedRecording) {
        sendJson(res, 400, { ok: false, error: "Both parties must consent before recording ingestion." });
        return true;
      }
      const body = await readBody<{
        provider: string;
        recordingUrl?: string;
        storageKey?: string;
        durationSeconds?: number;
        transcript?: string;
        callStartedAt?: string;
        callEndedAt?: string;
        meta?: Record<string, unknown>;
      }>(req);
      if (!body?.provider) {
        sendJson(res, 400, { ok: false, error: "provider required" });
        return true;
      }
      const recording = await prisma.consultationCallRecording.create({
        data: {
          consultationId,
          provider: body.provider,
          recordingUrl: body.recordingUrl,
          storageKey: body.storageKey,
          durationSeconds: body.durationSeconds ? Math.max(0, Math.floor(body.durationSeconds)) : undefined,
          transcript: body.transcript,
          callStartedAt: body.callStartedAt ? new Date(body.callStartedAt) : undefined,
          callEndedAt: body.callEndedAt ? new Date(body.callEndedAt) : undefined,
          patientConsented: consult.patientConsentedRecording,
          doctorConsented: consult.doctorConsentedRecording,
          meta: body.meta as Prisma.InputJsonValue | undefined
        }
      });
      sendJson(res, 201, { ok: true, recording });
      return true;
    }

    // ── POST /ratings/doctor ───────────────────────────────────────────────
    if (req.method === "POST" && path === "/ratings/doctor") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "PATIENT") {
        sendJson(res, 403, { ok: false, error: "Only patients can rate doctors." });
        return true;
      }
      const body = await readBody<{
        consultationId: string;
        doctorId: string;
        score: number;
        formAnswers: Record<string, unknown>;
        signature?: string;
      }>(req);
      if (!body?.consultationId || !body?.doctorId || !Number.isFinite(body.score)) {
        sendJson(res, 400, { ok: false, error: "consultationId, doctorId, score required." });
        return true;
      }
      const score = Math.max(0, Math.min(10, Math.round(body.score)));
      if (!body.formAnswers || Object.keys(body.formAnswers).length < 10) {
        sendJson(res, 400, { ok: false, error: "10-form answers are required." });
        return true;
      }
      const consult = await prisma.consultation.findFirst({
        where: {
          id: body.consultationId,
          AND: [
            { OR: [{ user1Id: auth.userId }, { user2Id: auth.userId }] },
            { OR: [{ user1Id: body.doctorId }, { user2Id: body.doctorId }] }
          ]
        }
      });
      if (!consult) {
        sendJson(res, 404, { ok: false, error: "Consultation/doctor relation not found." });
        return true;
      }
      const rating = await prisma.doctorRating.upsert({
        where: {
          consultationId_patientId_doctorId: {
            consultationId: body.consultationId,
            patientId: auth.userId,
            doctorId: body.doctorId
          }
        },
        update: {
          score,
          formAnswers: body.formAnswers as Prisma.InputJsonValue,
          signature: body.signature,
          status: "PENDING_VALIDATION"
        },
        create: {
          consultationId: body.consultationId,
          doctorId: body.doctorId,
          patientId: auth.userId,
          score,
          formAnswers: body.formAnswers as Prisma.InputJsonValue,
          signature: body.signature,
          status: "PENDING_VALIDATION"
        }
      });
      const validation = await runRatingValidation({
        consultationId: body.consultationId,
        doctorRatingId: rating.id,
        score,
        formAnswers: body.formAnswers
      });
      await prisma.doctorRating.update({
        where: { id: rating.id },
        data: { status: validation.autoDecision === "APPROVED" ? "APPROVED" : "FLAGGED" }
      });
      const agg = await prisma.doctorRating.aggregate({
        where: { doctorId: body.doctorId, status: "APPROVED" },
        _avg: { score: true },
        _count: { score: true }
      });
      await prisma.platformDoctor.updateMany({
        where: { userId: body.doctorId },
        data: { rating: agg._avg.score ?? 0 }
      });
      sendJson(res, 201, { ok: true, ratingId: rating.id, validation });
      return true;
    }

    // ── POST /ratings/patient ──────────────────────────────────────────────
    if (req.method === "POST" && path === "/ratings/patient") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Only doctors can rate patients." });
        return true;
      }
      const body = await readBody<{
        consultationId: string;
        patientId: string;
        score: number;
        formAnswers: Record<string, unknown>;
        signature?: string;
      }>(req);
      if (!body?.consultationId || !body?.patientId || !Number.isFinite(body.score)) {
        sendJson(res, 400, { ok: false, error: "consultationId, patientId, score required." });
        return true;
      }
      const score = Math.max(0, Math.min(10, Math.round(body.score)));
      if (!body.formAnswers || Object.keys(body.formAnswers).length < 10) {
        sendJson(res, 400, { ok: false, error: "10-form answers are required." });
        return true;
      }
      const rating = await prisma.patientRating.upsert({
        where: {
          consultationId_doctorId_patientId: {
            consultationId: body.consultationId,
            doctorId: auth.userId,
            patientId: body.patientId
          }
        },
        update: {
          score,
          formAnswers: body.formAnswers as Prisma.InputJsonValue,
          signature: body.signature,
          status: "PENDING_VALIDATION"
        },
        create: {
          consultationId: body.consultationId,
          doctorId: auth.userId,
          patientId: body.patientId,
          score,
          formAnswers: body.formAnswers as Prisma.InputJsonValue,
          signature: body.signature,
          status: "PENDING_VALIDATION"
        }
      });
      const validation = await runRatingValidation({
        consultationId: body.consultationId,
        patientRatingId: rating.id,
        score,
        formAnswers: body.formAnswers
      });
      await prisma.patientRating.update({
        where: { id: rating.id },
        data: { status: validation.autoDecision === "APPROVED" ? "APPROVED" : "FLAGGED" }
      });
      sendJson(res, 201, { ok: true, ratingId: rating.id, validation });
      return true;
    }

    // ── GET /ratings/review-queue ──────────────────────────────────────────
    if (req.method === "GET" && path === "/ratings/review-queue") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Doctors only review queue (admin-lite)." });
        return true;
      }
      const runs = await prisma.ratingValidationRun.findMany({
        where: { autoDecision: { in: ["FLAGGED", "PENDING_VALIDATION"] }, reviewerDecision: null },
        orderBy: { createdAt: "desc" },
        take: 100
      });
      sendJson(res, 200, { ok: true, runs });
      return true;
    }

    // ── POST /ratings/review/:id ───────────────────────────────────────────
    const reviewMatch = path.match(/^\/ratings\/review\/([^/]+)$/);
    if (req.method === "POST" && reviewMatch) {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Doctors only review endpoint." });
        return true;
      }
      const id = reviewMatch[1]!;
      const body = await readBody<{ decision: "APPROVED" | "REJECTED" | "FLAGGED"; note?: string }>(req);
      if (!body?.decision) {
        sendJson(res, 400, { ok: false, error: "decision required." });
        return true;
      }
      const updated = await prisma.ratingValidationRun.update({
        where: { id },
        data: {
          reviewedById: auth.userId,
          reviewerDecision: body.decision,
          reviewerNote: body.note,
          reviewedAt: new Date()
        }
      });
      if (updated.doctorRatingId) {
        await prisma.doctorRating.update({ where: { id: updated.doctorRatingId }, data: { status: body.decision } });
      }
      if (updated.patientRatingId) {
        await prisma.patientRating.update({ where: { id: updated.patientRatingId }, data: { status: body.decision } });
      }
      sendJson(res, 200, { ok: true, run: updated });
      return true;
    }

    // ── POST /doctors/upload-degree ─────────────────────────────────
    if (req.method === "POST" && path === "/doctors/upload-degree") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Doctors only" });
        return true;
      }

      const body = await readBody<{ fileName: string }>(req);
      if (!body?.fileName) {
        sendJson(res, 400, { ok: false, error: "fileName required" });
        return true;
      }

      const existing = await prisma.platformDoctor.findUnique({ where: { userId: auth.userId } });
      if (!existing) {
        sendJson(res, 404, { ok: false, error: "Doctor profile not found" });
        return true;
      }

      const doctor = await prisma.platformDoctor.update({
        where: { userId: auth.userId },
        data: {
          degreeFiles: [...existing.degreeFiles, body.fileName],
          verified: false,
        },
      });

      sendJson(res, 200, {
        ok: true,
        message: "Degree uploaded. Pending admin verification.",
        doctor,
      });
      return true;
    }

    // ── GET /doctors/digilocker/start ─────────────────────────────────
    if (req.method === "GET" && path === "/doctors/digilocker/start") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Doctors only" });
        return true;
      }
      const requestedState = url.searchParams.get("state") || undefined;
      const start = createDigilockerStartUrl(requestedState);
      digilockerStateToUser.set(start.state, auth.userId);
      sendJson(res, 200, { ok: true, authUrl: start.url, state: start.state });
      return true;
    }

    // ── GET /doctors/digilocker/callback ──────────────────────────────
    if (req.method === "GET" && path === "/doctors/digilocker/callback") {
      const code = url.searchParams.get("code") || "";
      const state = url.searchParams.get("state") || "";
      if (!code || !state) {
        sendJson(res, 400, { ok: false, error: "code and state required" });
        return true;
      }
      const userId = digilockerStateToUser.get(state);
      if (!userId) {
        sendJson(res, 400, { ok: false, error: "Invalid or expired DigiLocker state" });
        return true;
      }
      digilockerStateToUser.delete(state);
      const doctor = await prisma.platformDoctor.findUnique({ where: { userId } });
      if (!doctor) {
        sendJson(res, 404, { ok: false, error: "Doctor profile not found" });
        return true;
      }
      const accessToken = await exchangeDigilockerCode(code);
      const profile = await fetchDigilockerDegreeCandidate(accessToken);
      const hash = hashDigilockerDocumentId(profile.documentUri);
      const verification = await prisma.doctorVerification.create({
        data: {
          doctorId: doctor.id,
          provider: "digilocker",
          digilockerUserId: profile.digilockerUserId,
          documentUri: profile.documentUri,
          documentHash: hash,
          status: profile.documentUri ? "VERIFIED" : "PENDING",
          rawMeta: (profile.rawMeta ?? undefined) as Prisma.InputJsonValue | undefined
        }
      });
      const verified = verification.status === "VERIFIED";
      await prisma.platformDoctor.update({
        where: { id: doctor.id },
        data: { verified, degreeFiles: profile.documentUri ? [...doctor.degreeFiles, profile.documentUri] : doctor.degreeFiles }
      });
      sendJson(res, 200, {
        ok: true,
        verified,
        verificationId: verification.id,
        documentUri: profile.documentUri
      });
      return true;
    }

    // ── GET /doctors/verification-status ───────────────────────────────
    if (req.method === "GET" && path === "/doctors/verification-status") {
      const auth = requireAuth(req, res);
      if (!auth) return true;
      if (auth.role !== "DOCTOR") {
        sendJson(res, 403, { ok: false, error: "Doctors only" });
        return true;
      }
      const doctor = await prisma.platformDoctor.findUnique({
        where: { userId: auth.userId },
        include: { verifications: { orderBy: { createdAt: "desc" }, take: 10 } }
      });
      if (!doctor) {
        sendJson(res, 404, { ok: false, error: "Doctor profile not found" });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        verified: doctor.verified,
        degreeFiles: doctor.degreeFiles,
        verifications: doctor.verifications
      });
      return true;
    }

    // ── GET /profile ──────────────────────────────────────────────────
    if (req.method === "GET" && path === "/profile") {
      const auth = requireAuth(req, res);
      if (!auth) return true;

      const user = await prisma.platformUser.findUnique({
        where: { id: auth.userId },
        include: {
          doctor: true,
          patient: true,
          posts: { orderBy: { createdAt: "desc" }, take: 10 },
          replies: { orderBy: { createdAt: "desc" }, take: 10 },
          tipsReceived: { orderBy: { createdAt: "desc" }, take: 20, include: { giver: { select: { name: true } } } },
          _count: { select: { posts: true, consultsAs1: true, consultsAs2: true, tipsGiven: true } },
        },
      });

      if (!user) {
        sendJson(res, 404, { ok: false, error: "User not found" });
        return true;
      }

      const consultCount =
        (user._count?.consultsAs1 ?? 0) + (user._count?.consultsAs2 ?? 0);

      sendJson(res, 200, {
        ok: true,
        user: safeUser(user),
        stats: {
          posts: user._count?.posts ?? 0,
          consultations: consultCount,
          tipsGivenCount: user._count?.tipsGiven ?? 0,
        },
        profile:
          user.role === "PATIENT" && user.patient
            ? {
                name: user.name,
                age: user.patient.age,
                bloodGroup: user.patient.bloodGroup,
                city: user.patient.city,
                languages: user.patient.languages,
                medications: user.patient.medications,
                conditions: user.patient.conditions,
                allergies: user.patient.allergies,
              }
            : user.role === "DOCTOR" && user.doctor
              ? {
                  name: user.name,
                  specialty: user.doctor.specialty,
                  regNo: user.doctor.regNo,
                  hospital: user.doctor.hospital,
                  experience: user.doctor.experience,
                  bio: user.doctor.bio,
                  fee: user.doctor.fee,
                }
              : null,
      });
      return true;
    }

    // ── PUT /profile — save personal / professional details to Postgres ─
    if (req.method === "PUT" && path === "/profile") {
      const auth = requireAuth(req, res);
      if (!auth) return true;

      const body = await readBody<{
        name?: string;
        age?: number;
        bloodGroup?: string;
        city?: string;
        languages?: string;
        medications?: string;
        conditions?: string[] | string;
        allergies?: string[] | string;
        specialty?: string;
        regNo?: string;
        hospital?: string;
        experience?: number;
        bio?: string;
        fee?: number;
      }>(req);

      const user = await prisma.platformUser.findUnique({
        where: { id: auth.userId },
        include: { doctor: true, patient: true },
      });
      if (!user) {
        sendJson(res, 404, { ok: false, error: "User not found" });
        return true;
      }

      const name = body?.name?.trim();
      if (name) {
        await prisma.platformUser.update({
          where: { id: auth.userId },
          data: { name },
        });
      }

      const toList = (v: string[] | string | undefined): string[] | undefined => {
        if (v === undefined) return undefined;
        if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
        return String(v)
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      };

      if (user.role === "PATIENT") {
        const p = user.patient;
        const conditions =
          body?.conditions !== undefined ? (toList(body.conditions) ?? []) : (p?.conditions ?? []);
        const allergies =
          body?.allergies !== undefined ? (toList(body.allergies) ?? []) : (p?.allergies ?? []);
        await persistPatientProfile(auth.userId, {
          age: body?.age !== undefined ? Number(body.age) || null : (p?.age ?? null),
          bloodGroup:
            body?.bloodGroup !== undefined ? body.bloodGroup.trim() || null : (p?.bloodGroup ?? null),
          city: body?.city !== undefined ? body.city.trim() || null : (p?.city ?? null),
          languages:
            body?.languages !== undefined ? body.languages.trim() || null : (p?.languages ?? null),
          medications:
            body?.medications !== undefined ? body.medications.trim() || null : (p?.medications ?? null),
          conditions,
          allergies,
        });
      } else if (user.role === "DOCTOR" && user.doctor) {
        await prisma.platformDoctor.update({
          where: { userId: auth.userId },
          data: {
            ...(body?.specialty !== undefined ? { specialty: body.specialty.trim() } : {}),
            ...(body?.regNo !== undefined ? { regNo: body.regNo.trim() } : {}),
            ...(body?.hospital !== undefined ? { hospital: body.hospital.trim() || null } : {}),
            ...(body?.experience !== undefined ? { experience: Number(body.experience) || 0 } : {}),
            ...(body?.bio !== undefined ? { bio: body.bio.trim() || null } : {}),
            ...(body?.fee !== undefined ? { fee: Number(body.fee) || 500 } : {}),
          },
        });
      } else {
        sendJson(res, 403, { ok: false, error: "Profile type not supported" });
        return true;
      }

      const updated = await prisma.platformUser.findUnique({
        where: { id: auth.userId },
        include: { doctor: true, patient: true },
      });

      sendJson(res, 200, {
        ok: true,
        storedInDatabase: true,
        user: updated ? safeUser(updated) : null,
        message: "Profile saved to database",
      });
      return true;
    }

    sendJson(res, 404, { ok: false, error: `Unknown platform route: ${path}` });
    return true;
  } catch (e) {
    console.error("[doctorPlatformApi]", e);
    sendJson(res, 500, {
      ok: false,
      error: e instanceof Error ? e.message : "Platform API error",
    });
    return true;
  }
}
