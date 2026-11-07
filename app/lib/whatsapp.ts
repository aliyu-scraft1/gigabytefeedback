export interface WhatsAppConfig {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
}

export interface NotificationResult {
  sent: boolean;
  provider: "twilio";
  status: "sent" | "not-configured" | "failed";
  sid?: string;
  message?: string;
}

export function normalizeWhatsAppNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const withoutPrefix = trimmed.replace(/^whatsapp:/i, "").trim();
  const digits = withoutPrefix.replace(/\D/g, "");

  if (!digits) return "";

  if (withoutPrefix.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (withoutPrefix.startsWith("0")) return `+234${digits.slice(1)}`;
  return `+${digits}`;
}

export function getWhatsAppConfig(): WhatsAppConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  const to = process.env.BOSS_WHATSAPP_NUMBER?.trim() || process.env.BOSS_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !from || !to) {
    return null;
  }

  return {
    accountSid,
    authToken,
    from: normalizeWhatsAppNumber(from),
    to: normalizeWhatsAppNumber(to),
  };
}

export async function sendCustomerFeedbackWhatsApp(message: string, reference?: string): Promise<NotificationResult> {
  const config = getWhatsAppConfig();

  if (!config) {
    return {
      sent: false,
      provider: "twilio",
      status: "not-configured",
      message: "Twilio WhatsApp credentials are not configured.",
    };
  }

  const body = new URLSearchParams({
    To: `whatsapp:${config.to}`,
    From: `whatsapp:${config.from}`,
    Body: reference
      ? `${message}\n\nReply to this WhatsApp with: /reply ${reference} your response`
      : message,
  });

  const authHeader = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body,
      },
    );

    const text = await response.text();

    if (!response.ok) {
      return {
        sent: false,
        provider: "twilio",
        status: "failed",
        message: `Twilio rejected the outbound WhatsApp message: ${text}`,
      };
    }

    const parsed = JSON.parse(text) as { sid?: string };

    return {
      sent: true,
      provider: "twilio",
      status: "sent",
      sid: parsed.sid,
      message: "WhatsApp notified the Boss successfully.",
    };
  } catch (error) {
    return {
      sent: false,
      provider: "twilio",
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown WhatsApp error.",
    };
  }
}
