"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeedbackCategory, FeedbackSystemState } from "../lib/SHA";

const STORAGE_KEY = "gigabyte-feedback-system-v1";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  category: "General Feedback" as FeedbackCategory,
  purpose: "",
  problem: "",
  issue: "",
  rating: 5,
  additional: "",
};

function readStoredState(): FeedbackSystemState {
  if (typeof window === "undefined") {
    return { conversations: [], trash: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversations: [], trash: [] };
    const parsed = JSON.parse(raw) as FeedbackSystemState;
    return parsed && Array.isArray(parsed.conversations) ? parsed : { conversations: [], trash: [] };
  } catch {
    return { conversations: [], trash: [] };
  }
}

function writeStoredState(state: FeedbackSystemState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function CustomerFeedbackPage() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(field: string, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.purpose.trim() ||
      !form.problem.trim() ||
      !form.issue.trim()
    ) {
      setError("Please complete all required fields before submitting your feedback.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          category: form.category,
          purpose: form.purpose,
          problem: form.problem,
          issue: form.issue,
          rating: form.rating,
          additional: form.additional,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        conversationId?: string;
        whatsappUrl?: string;
      };

      if (!response.ok || !result.ok) {
        setError(result.error || "Your feedback could not be submitted right now.");
        return;
      }

      try {
        const existing = readStoredState();
        const nextConversations: FeedbackSystemState["conversations"] = [
          {
            id: result.conversationId ?? `${Date.now()}`,
            customerName: form.name,
            phone: form.phone,
            email: form.email,
            conversationId: result.conversationId ?? `${Date.now()}`,
            category: form.category,
            status: "New",
            unread: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [
              {
                id: `msg-${Date.now()}`,
                sender: "customer",
                text: [
                  `Category: ${form.category}`,
                  `Purpose: ${form.purpose}`,
                  `Problem: ${form.problem}`,
                  `What happened: ${form.issue}`,
                  `Rating: ${form.rating}/5`,
                  form.additional ? `Additional feedback: ${form.additional}` : "",
                ]
                  .filter(Boolean)
                  .join("\n"),
                createdAt: new Date().toISOString(),
              },
            ],
          },
          ...existing.conversations,
        ];

        const nextState: FeedbackSystemState = { conversations: nextConversations, trash: existing.trash ?? [] };
        writeStoredState(nextState);

        window.localStorage.setItem(
          "gigabyte-customer-session",
          JSON.stringify({
            customerName: form.name,
            phone: form.phone,
            email: form.email,
            conversationId: result.conversationId ?? nextConversations[0]?.conversationId ?? "",
          }),
        );
      } catch {
        // The database save succeeded; browser storage is only a local convenience.
      }

      if (!result.whatsappUrl) {
        setError(result.error || "Your feedback was saved, but the WhatsApp chat link could not be created.");
        return;
      }

      window.location.assign(result.whatsappUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send your feedback right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.20),transparent_30%),linear-gradient(135deg,_#fef3c7_0%,_#fdf2f8_25%,_#ecfeff_55%,_#f5f3ff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-[0_25px_80px_rgba(76,29,149,0.18)] backdrop-blur-xl md:p-8">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500 p-[1px]">
          <div className="rounded-2xl bg-slate-950/90 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Gigabyte</p>
          </div>
        </div>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
          Tell us about <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-600 bg-clip-text text-transparent">your visit</span>
        </h1>

        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full Name</label>
              <input value={form.name} onChange={(event) => handleChange("name", event.target.value)} className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-200" placeholder="Your full name" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone Number</label>
              <input value={form.phone} onChange={(event) => handleChange("phone", event.target.value)} className="w-full rounded-2xl border border-cyan-200 bg-cyan-50/60 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-200" placeholder="Your phone number" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email Address</label>
            <input value={form.email} onChange={(event) => handleChange("email", event.target.value)} className="w-full rounded-2xl border border-violet-200 bg-violet-50/70 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-200" placeholder="Your email address" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Feedback category</label>
            <select value={form.category} onChange={(event) => handleChange("category", event.target.value)} className="w-full rounded-2xl border border-violet-200 bg-violet-50/70 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-200">
              <option value="Complaint">Complaint</option>
              <option value="Praise / Good Review">Praise / Good Review</option>
              <option value="General Feedback">General Feedback</option>
              <option value="Customer Message">Customer Message</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">What did you come to Gigabyte for?</label>
            <input value={form.purpose} onChange={(event) => handleChange("purpose", event.target.value)} className="w-full rounded-2xl border border-orange-200 bg-orange-50/70 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-200" placeholder="What service, issue, or reason brought you to Gigabyte?" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">What problem did you experience?</label>
            <textarea value={form.problem} onChange={(event) => handleChange("problem", event.target.value)} className="min-h-24 w-full rounded-2xl border border-pink-200 bg-pink-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-200" placeholder="Please tell us the main problem you experienced." />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">What happened?</label>
            <textarea value={form.issue} onChange={(event) => handleChange("issue", event.target.value)} className="min-h-28 w-full rounded-2xl border border-fuchsia-200 bg-fuchsia-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-200" placeholder="Please share what happened during your visit." />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">How would you rate your experience?</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => handleChange("rating", star)} className={`text-3xl transition hover:scale-110 ${star <= form.rating ? "text-yellow-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]" : "text-slate-300"}`} aria-label={`Rate ${star} out of 5`}>
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Additional feedback / comments</label>
            <textarea value={form.additional} onChange={(event) => handleChange("additional", event.target.value)} className="min-h-24 w-full rounded-2xl border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-200" placeholder="Anything else you would like us to know?" />
          </div>

          {error && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">{error}</p>}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link href="/" className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400">Back home</Link>
            <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-500 to-violet-500 px-4 py-3 text-sm font-bold uppercase tracking-[0.15em] text-white shadow-[0_16px_28px_rgba(59,130,246,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_32px_rgba(168,85,247,0.35)] disabled:cursor-wait disabled:opacity-70">
              {isSubmitting ? "Saving feedback…" : "Send Feedback"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
