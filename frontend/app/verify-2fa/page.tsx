"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearPlatformAuth,
  completeAuth,
  getPending2fa,
  normalizeAuthResult,
  verify2fa
} from "../../lib/platform-client";

export default function Verify2faPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getPending2fa()) router.replace("/login");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pending = getPending2fa();
    if (!pending) {
      router.replace("/login");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const result = await verify2fa(pending, code.replace(/\s/g, ""));
      completeAuth(normalizeAuthResult(result));
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">🔐</div>
          <h1>Two-step verification</h1>
          <p>Enter the 6-digit code from your authenticator app</p>
        </div>

        {err ? <div className="auth-err">{err}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              className="auth-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
        </form>

        <p className="auth-foot">
          <Link
            href="/login"
            onClick={() => {
              clearPlatformAuth();
            }}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
