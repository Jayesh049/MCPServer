import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const result = verifySync({ secret, token: normalized, epochTolerance: 1 });
  return result.valid;
}

export function totpOtpauthUrl(email: string, secret: string): string {
  return generateURI({
    issuer: "Agents Assemble Platform",
    label: email,
    secret,
  });
}

export async function totpQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}
