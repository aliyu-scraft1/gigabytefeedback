import { NextResponse } from "next/server";
import { requestHasAdminSession } from "../../../lib/admin-auth";
import { sendCustomerFeedbackWhatsApp } from "../../../lib/whatsapp";

export async function POST(request: Request) {
  if (!requestHasAdminSession(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const message = [
    "Gigabyte WhatsApp test notification.",
    "This is a test message to verify the configured Boss WhatsApp number.",
    "If you received this, the provider configuration is working.",
  ].join("\n");

  const result = await sendCustomerFeedbackWhatsApp(message);

  return NextResponse.json({
    ok: result.sent,
    result,
  }, {
    status: result.sent ? 200 : 503,
  });
}
