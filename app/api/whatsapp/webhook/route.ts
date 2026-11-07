import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { appendFeedbackMessage, readFeedbackStateFromDatabase } from "../../../lib/server-feedback-store";
import { getWhatsAppConfig, normalizeWhatsAppNumber } from "../../../lib/whatsapp";

function isValidTwilioSignature(url: string, params: URLSearchParams, signature: string, authToken: string) {
  const payload = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce((value, [key, entry]) => value + key + entry, url);
  const expected = createHmac("sha1", authToken).update(payload).digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function twiml(message: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const signature = request.headers.get("x-twilio-signature");
  const formData = await request.formData();
  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") params.append(key, value);
  }

  const webhookUrl = process.env.TWILIO_WEBHOOK_URL?.trim() || request.url;
  if (!authToken || !signature || !isValidTwilioSignature(webhookUrl, params, signature, authToken)) {
    return NextResponse.json({ ok: false, error: "Invalid Twilio signature." }, { status: 403 });
  }

  const config = getWhatsAppConfig();
  const sender = normalizeWhatsAppNumber(params.get("From") ?? "");
  const recipient = normalizeWhatsAppNumber(params.get("To") ?? "");
  const body = (params.get("Body") ?? "").trim();
  const reply = body.match(/^\/reply\s+(fb-[a-z0-9-]+)\s+([\s\S]+)$/i);

  if (!config || sender !== config.to || recipient !== config.from || !reply) {
    return twiml("Reply not saved. Use /reply <reference> <your response> from the configured admin WhatsApp number.");
  }

  const reference = reply[1];
  const text = reply[2].trim();
  const state = await readFeedbackStateFromDatabase();
  const conversation = state.conversations.find((item) => item.id === reference);
  if (!conversation || !text) {
    return twiml("That feedback reference was not found. Check the reference and try again.");
  }

  const saved = await appendFeedbackMessage(reference, {
    id: params.get("MessageSid") || `whatsapp-${Date.now()}`,
    sender: "agent",
    text,
    createdAt: new Date().toISOString(),
  });

  return twiml(saved ? "Your reply was added to the admin inbox." : "That feedback thread could not be updated.");
}
