import { NextResponse } from "next/server";
import { createBlankFeedbackRecord, DEFAULT_FEEDBACK_CATEGORIES, type FeedbackCategory } from "../../lib/SHA";
import { saveFeedbackRecord } from "../../lib/server-feedback-store";
import { normalizeWhatsAppNumber } from "../../lib/whatsapp";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const customerName = String(payload?.name ?? "").trim();
    const phone = String(payload?.phone ?? "").trim();
    const email = String(payload?.email ?? "").trim().toLowerCase();
    const category = String(payload?.category ?? "").trim();
    const purpose = String(payload?.purpose ?? "").trim();
    const problem = String(payload?.problem ?? "").trim();
    const issue = String(payload?.issue ?? "").trim();
    const rating = Number(payload?.rating ?? 5);
    const additional = String(payload?.additional ?? "").trim();
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const phoneDigits = phone.replace(/\D/g, "");
    const messageFieldsAreWithinLimit = [customerName, phone, email].every((value) => value.length <= 254)
      && [purpose, problem, issue, additional].every((value) => value.length <= 5000);

    if (
      !customerName || customerName.length > 120
      || !phone || phoneDigits.length < 7 || phoneDigits.length > 20
      || !emailIsValid
      || !purpose || !problem || !issue
      || !messageFieldsAreWithinLimit
      || !Number.isInteger(rating) || rating < 1 || rating > 5
      || !DEFAULT_FEEDBACK_CATEGORIES.includes(category as FeedbackCategory)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please enter a valid name, phone number, email, rating, and complete all required feedback fields.",
        },
        { status: 400 },
      );
    }

    const feedbackText = [
      `Customer: ${customerName}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Category: ${category}`,
      `Purpose: ${purpose}`,
      `Problem: ${problem}`,
      `What happened: ${issue}`,
      `Rating: ${rating}/5`,
      `Additional feedback: ${additional || "None"}`,
    ].join("\n");

    const record = createBlankFeedbackRecord({
      customerName,
      phone,
      email,
      message: feedbackText,
      category: category as FeedbackCategory,
    });

    await saveFeedbackRecord(record as unknown as Record<string, unknown>);

    const configuredNumber = process.env.BOSS_WHATSAPP_NUMBER?.trim() || process.env.BOSS_PHONE_NUMBER?.trim();
    const normalizedNumber = normalizeWhatsAppNumber(configuredNumber ?? "");
    const whatsappNumber = normalizedNumber.replace(/\D/g, "");
    if (whatsappNumber.length < 8 || whatsappNumber.length > 15) {
      return NextResponse.json({
        ok: true,
        saved: true,
        conversationId: record.id,
        error: "Your feedback was saved, but the boss's WhatsApp number is missing or invalid. Check BOSS_WHATSAPP_NUMBER in the project root .env.",
      });
    }

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(feedbackText)}`;

    return NextResponse.json({
      ok: true,
      saved: true,
      conversationId: record.id,
      whatsappUrl,
    });
  } catch (error) {
    const isMissingDatabaseUrl = error instanceof Error && error.message === "DATABASE_URL is required to connect to the feedback database.";
    return NextResponse.json(
      {
        ok: false,
        error: isMissingDatabaseUrl
          ? "DATABASE_URL is required to connect to the feedback database. Add your Neon connection string to the project root .env file."
          : "Feedback could not be saved. Check the database connection and try again.",
      },
      { status: 500 },
    );
  }
}
