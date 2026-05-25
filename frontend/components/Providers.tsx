"use client";

import type { ReactNode } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ThemeProvider } from "../lib/theme";

export function Providers({ children }: { children: ReactNode }) {
  const googleId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  const inner = <ThemeProvider>{children}</ThemeProvider>;

  if (!googleId) return inner;
  return <GoogleOAuthProvider clientId={googleId}>{inner}</GoogleOAuthProvider>;
}
