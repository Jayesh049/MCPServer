"use client";

import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

type Props = {
  onSuccess: (idToken: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
};

export function GoogleSignInButton({ onSuccess, onError, disabled }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return (
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
        Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in
      </p>
    );
  }

  return (
    <div className="auth-google-wrap" style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <GoogleLogin
        onSuccess={(res: CredentialResponse) => {
          if (res.credential) onSuccess(res.credential);
          else onError?.("Google did not return a credential");
        }}
        onError={() => onError?.("Google sign-in failed")}
        theme="filled_black"
        size="large"
        text="continue_with"
        shape="rectangular"
        width="320"
      />
    </div>
  );
}
