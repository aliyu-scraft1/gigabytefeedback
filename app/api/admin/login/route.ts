import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  isValidAdminCredentials,
} from "../../../lib/admin-auth";

export async function POST(request: Request) {
  if (!process.env.ADMIN_SESSION_SECRET?.trim()) {
    return NextResponse.json({ ok: false, message: "Admin sign-in is not configured on this deployment." }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Enter your admin email and password." }, { status: 400 });
  }

  const email = String((payload as { email?: unknown } | null)?.email ?? "");
  const password = String((payload as { password?: unknown } | null)?.password ?? "");
  if (!isValidAdminCredentials(email, password)) {
    return NextResponse.json({ ok: false, message: "The email or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
