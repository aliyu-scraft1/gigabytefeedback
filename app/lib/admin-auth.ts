import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "gigabyte_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() ?? "";
}

function constantTimeStringEqual(left: string, right: string) {
  const leftHash = createHmac("sha256", "admin-login-comparison").update(left).digest();
  const rightHash = createHmac("sha256", "admin-login-comparison").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function isValidAdminCredentials(email: string, password: string) {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim() ?? "";
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!expectedEmail || !expectedPassword || !email.trim() || !password) return false;

  return constantTimeStringEqual(email.trim().toLowerCase(), expectedEmail.toLowerCase())
    && constantTimeStringEqual(password, expectedPassword);
}

export function createAdminSessionToken(now = Date.now()) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");

  const payload = Buffer.from(JSON.stringify({
    expiresAt: Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function isValidAdminSession(token: string | undefined, now = Date.now()) {
  const secret = getSessionSecret();
  if (!secret || !token) return false;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;

  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret).update(payload).digest();
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: number };
    return typeof session.expiresAt === "number" && session.expiresAt > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function getAdminSessionToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (!cookie) return undefined;

  try {
    return decodeURIComponent(cookie.slice(ADMIN_SESSION_COOKIE.length + 1));
  } catch {
    return undefined;
  }
}

export function requestHasAdminSession(request: Request) {
  return isValidAdminSession(getAdminSessionToken(request));
}
