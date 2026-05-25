"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getPlatformToken } from "../../lib/platform-client";

/** Redirect when no platform JWT (client-only). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getPlatformToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="auth-root">
        <p style={{ color: "rgba(255,255,255,0.6)" }}>Loading…</p>
      </div>
    );
  }
  return <>{children}</>;
}

/** Redirect away from login/signup when already signed in. */
export function RedirectIfAuthed({ to = "/platform" }: { to?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (getPlatformToken()) router.replace(to);
  }, [router, to]);
  return null;
}
