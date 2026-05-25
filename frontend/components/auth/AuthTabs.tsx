"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthTabs() {
  const pathname = usePathname();
  const onLogin = pathname === "/login";
  const onSignup = pathname === "/signup";

  return (
    <div className="auth-tabs">
      <Link href="/login" className={`auth-tab${onLogin ? " on" : ""}`}>
        Sign in
      </Link>
      <Link href="/signup" className={`auth-tab${onSignup ? " on" : ""}`}>
        Sign up
      </Link>
    </div>
  );
}
