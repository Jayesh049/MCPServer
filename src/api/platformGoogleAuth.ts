import { OAuth2Client } from "google-auth-library";

let client: OAuth2Client | null = null;

function getGoogleClient(): OAuth2Client | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) return null;
  if (!client) client = new OAuth2Client(id);
  return client;
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  const oauth = getGoogleClient();
  if (!oauth) {
    throw new Error("GOOGLE_CLIENT_ID is not configured on the server");
  }
  const ticket = await oauth.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) return null;
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email.split("@")[0] ?? "User",
    emailVerified: payload.email_verified === true,
  };
}
