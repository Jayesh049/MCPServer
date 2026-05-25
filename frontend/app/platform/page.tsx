"use client";

import { RequireAuth } from "../../components/auth/AuthGate";

/** Full-screen doctor/patient UI (files 7) after authentication. */
export default function PlatformPage() {
  return (
    <RequireAuth>
      <div className="platform-frame-wrap">
        <iframe
          className="platform-frame"
          title="Doctor and patient platform"
          src="/platform/index.html"
          allow="clipboard-write"
        />
      </div>
    </RequireAuth>
  );
}
