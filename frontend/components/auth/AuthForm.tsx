"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RedirectIfAuthed } from "./AuthGate";
import { GoogleAuthButton } from "./GoogleAuthButton";
import {
  completeAuth,
  loginEmail,
  loginGoogle,
  normalizeAuthResult,
  registerUser,
  type AuthResult
} from "../../lib/platform-client";

type Mode = "signin" | "signup";
type Role = "DOCTOR" | "PATIENT";

type Props = {
  initialMode?: Mode;
  googleFinish?: boolean;
};

export function AuthForm({ initialMode = "signin", googleFinish = false }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role>("PATIENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState("General Physician");
  const [regNo, setRegNo] = useState("");
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("google_id_token");
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";
  const googleRoleFinish = googleFinish || Boolean(googleIdToken);

  useEffect(() => {
    if (!googleRoleFinish) return;
    try {
      const raw = sessionStorage.getItem("google_signup");
      if (!raw) return;
      const g = JSON.parse(raw) as { email: string; name: string };
      setEmail(g.email);
      setName(g.name);
    } catch {
      /* ignore */
    }
  }, [googleRoleFinish]);

  async function handleGoogle(idToken: string) {
    setErr("");
    setBusy(true);
    try {
      const raw = await loginGoogle(idToken, isSignup && !googleRoleFinish ? role : undefined, {
        specialty,
        regNo: regNo || "GOOGLE"
      });
      const result = normalizeAuthResult(raw);
      handleGoogleResult(result, idToken);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Google failed");
    } finally {
      setBusy(false);
    }
  }

  function handleGoogleResult(result: AuthResult, idToken: string) {
    if (result.step === "needs_role") {
      sessionStorage.setItem("google_id_token", idToken);
      sessionStorage.setItem(
        "google_signup",
        JSON.stringify({ email: result.email, name: result.name, googleId: result.googleId })
      );
      setGoogleIdToken(idToken);
      setEmail(result.email);
      setName(result.name);
      setMode("signup");
      return;
    }
    sessionStorage.removeItem("google_id_token");
    sessionStorage.removeItem("google_signup");
    completeAuth(result);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (googleIdToken && isSignup) {
        const raw = await loginGoogle(googleIdToken, role, { specialty, regNo: regNo || "GOOGLE" });
        sessionStorage.removeItem("google_id_token");
        sessionStorage.removeItem("google_signup");
        completeAuth(normalizeAuthResult(raw));
        return;
      }

      if (isSignup) {
        const raw = await registerUser({
          email: email.trim(),
          password,
          name: name.trim(),
          role,
          ...(role === "DOCTOR" ? { specialty, regNo, experience: 0, hospital: "" } : {})
        });
        completeAuth(normalizeAuthResult(raw));
        return;
      }

      const raw = await loginEmail(email.trim(), password);
      completeAuth(normalizeAuthResult(raw));
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "Request failed";
      if (msg.includes("PlatformUser") || msg.includes("does not exist")) {
        setErr("Database tables missing — run: npm run db:migrate:deploy");
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  const googleLabel = isSignup ? "Sign up with Google" : "Sign in with Google";
  const primaryLabel = busy
    ? isSignup
      ? "Creating account…"
      : "Signing in…"
    : googleRoleFinish
      ? "Complete sign up"
      : isSignup
        ? "Sign up"
        : "Sign in";

  return (
    <div className="auth-root">
      <RedirectIfAuthed />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">🩺</div>
          <h1>{isSignup ? "Create account" : "Welcome back"}</h1>
          <p>Doctor &amp; patient platform · accounts saved in PostgreSQL</p>
        </div>

        {!googleRoleFinish ? (
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${mode === "signin" ? " on" : ""}`}
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab${mode === "signup" ? " on" : ""}`}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>
        ) : null}

        {err ? <div className="auth-err">{err}</div> : null}

        {(isSignup || googleRoleFinish) && (
          <div className="auth-role-toggle">
            <button
              type="button"
              className={`auth-role-btn${role === "PATIENT" ? " on" : ""}`}
              onClick={() => setRole("PATIENT")}
            >
              Patient
            </button>
            <button
              type="button"
              className={`auth-role-btn${role === "DOCTOR" ? " on" : ""}`}
              onClick={() => setRole("DOCTOR")}
            >
              Doctor
            </button>
          </div>
        )}

        {!googleRoleFinish ? (
          <>
            <GoogleAuthButton
              label={googleLabel}
              mode={isSignup ? "signup" : "signin"}
              onSuccess={handleGoogle}
              onError={setErr}
              disabled={busy}
            />
            <div className="auth-divider">or use email</div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
            Finish Google sign-up for <strong style={{ color: "#fff" }}>{email}</strong>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {isSignup && !googleRoleFinish ? (
            <div className="auth-field">
              <label className="auth-label">Full name</label>
              <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          ) : null}

          {!googleRoleFinish ? (
            <>
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Password</label>
                <input
                  className="auth-input"
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!googleRoleFinish}
                  minLength={isSignup ? 8 : undefined}
                />
              </div>
            </>
          ) : null}

          {(isSignup || googleRoleFinish) && role === "DOCTOR" ? (
            <>
              <div className="auth-field">
                <label className="auth-label">Specialty</label>
                <input className="auth-input" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-label">Registration no.</label>
                <input className="auth-input" value={regNo} onChange={(e) => setRegNo(e.target.value)} />
              </div>
            </>
          ) : null}

          <button className="auth-btn" type="submit" disabled={busy}>
            {primaryLabel}
          </button>
        </form>

        {googleRoleFinish ? (
          <GoogleAuthButton
            label="Sign up with Google"
            mode="signup"
            onSuccess={handleGoogle}
            onError={setErr}
            disabled={busy}
          />
        ) : null}

        <p className="auth-foot">
          {isSignup ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Sign up</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
