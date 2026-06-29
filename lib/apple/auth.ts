import { SignJWT, importPKCS8 } from "jose";
import type { AppleCredentials } from "./types";

const TOKEN_LIFETIME_SECONDS = 20 * 60; // Apple max: 20 minutes

function normalizePrivateKey(privateKey: string): string {
  const trimmed = privateKey.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) {
    return trimmed;
  }
  const body = trimmed.replace(/\s/g, "");
  const lines = body.match(/.{1,64}/g) ?? [body];
  return ["-----BEGIN PRIVATE KEY-----", ...lines, "-----END PRIVATE KEY-----"].join(
    "\n"
  );
}

export async function generateAppleJwt(credentials: AppleCredentials): Promise<string> {
  const { issuerId, keyId, privateKey } = credentials;

  if (!issuerId || !keyId || !privateKey) {
    throw new Error("Issuer ID, Key ID, and private key are required.");
  }

  const normalizedKey = normalizePrivateKey(privateKey);
  const cryptoKey = await importPKCS8(normalizedKey, "ES256");

  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_LIFETIME_SECONDS)
    .sign(cryptoKey);
}
