"use client";

import { useRef } from "react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

type Props = {
  label: string;
  onSuccess: (idToken: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
  mode?: "signin" | "signup";
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

/** Custom-styled button that opens Google Sign-In (saves user to Postgres via API). */
export function GoogleAuthButton({ label, onSuccess, onError, disabled, mode = "signin" }: Props) {
  const hiddenRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  function triggerGoogle() {
    const root = hiddenRef.current;
    if (!root) return;
    const btn =
      root.querySelector('[role="button"]') ??
      root.querySelector("div[tabindex='0']") ??
      root.querySelector("iframe");
    if (btn instanceof HTMLElement) btn.click();
  }

  if (!clientId) {
    return (
      <button type="button" className="auth-btn-google" disabled title="Add NEXT_PUBLIC_GOOGLE_CLIENT_ID">
        <GoogleIcon />
        {label}
      </button>
    );
  }

  return (
    <>
      <button type="button" className="auth-btn-google" disabled={disabled} onClick={triggerGoogle}>
        <GoogleIcon />
        {label}
      </button>
      <div ref={hiddenRef} className="auth-google-hidden" aria-hidden>
        <GoogleLogin
          onSuccess={(res: CredentialResponse) => {
            if (res.credential) onSuccess(res.credential);
            else onError?.("Google did not return a credential");
          }}
          onError={() => onError?.("Google sign-in failed")}
          theme="outline"
          size="large"
          text={mode === "signup" ? "signup_with" : "signin_with"}
          shape="rectangular"
          width="360"
        />
      </div>
    </>
  );
}
