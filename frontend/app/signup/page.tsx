"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "../../components/auth/AuthForm";

function SignupPageInner() {
  const params = useSearchParams();
  const googleFinish = params.get("google") === "1";
  return <AuthForm initialMode="signup" googleFinish={googleFinish} />;
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-root">
          <p style={{ color: "rgba(255,255,255,0.55)" }}>Loading…</p>
        </div>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}
