"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPlatformToken } from "../lib/platform-client";

/** Entry: signed-in users → platform; others → login (not Disease Hub). */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getPlatformToken() ? "/platform" : "/login");
  }, [router]);

  return (
    <div className="auth-root">
      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>Redirecting…</p>
    </div>
  );
}
