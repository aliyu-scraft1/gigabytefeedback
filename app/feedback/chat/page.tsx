"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SHAFeedbackSystem, type FeedbackMessage, type FeedbackSystemState } from "../../lib/SHA";

const STORAGE_KEY = "gigabyte-feedback-system-v1";

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

function readCustomerSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("gigabyte-customer-session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CustomerChatPage() {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Waiting for a response");

  useEffect(() => {
    const customer = readCustomerSession();
    if (!customer) {
      const conversations = readStoredState().conversations;
      const last = conversations[0];
      if (last) {
        setMessages(last.messages);
        setStatus(last.status === "Solved" ? "Solved" : "Open");
      }
      return;
    }

    const system = new SHAFeedbackSystem(readStoredState());
    const conversation = system.getCustomerConversationById(
      system.getState().conversations.find((item) => item.phone === customer.phone && item.email === customer.email)?.id ?? "",
      customer.phone,
      customer.email,
    );

    if (conversation) {
      setMessages(conversation.messages);
      setStatus(conversation.status === "Solved" ? "Solved" : conversation.status);
    }
  }, []);

  function sendMessage() {
    if (!draft.trim()) return;

    const customer = readCustomerSession();
    const system = new SHAFeedbackSystem(readStoredState());
    const conversations = system.getState().conversations;
    const conversation = conversations.find((item) => {
      if (!customer) return false;
      return item.phone === customer.phone && item.email === customer.email;
    });

    if (!conversation) {
      setStatus("No active conversation found.");
      return;
    }

    system.addCustomerReply(conversation.id, draft.trim());
    const nextState = system.getState();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }
    setMessages(system.getState().conversations.find((item) => item.id === conversation.id)?.messages ?? []);
    setDraft("");
    setStatus("Waiting for a response");
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Gigabyte</p>
            <h1 className="text-xl font-bold">Customer Support</h1>
            <p className="text-xs text-slate-500">Status: {status}</p>
          </div>
          <Link href="/" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Back home</Link>
        </header>

        <div className="max-h-[500px] space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No messages yet.</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.sender === "customer" ? "ml-auto bg-emerald-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                <p>{message.text}</p>
                <p className={`mt-1 text-[10px] ${message.sender === "customer" ? "text-emerald-100" : "text-slate-500"}`}>{new Date(message.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="flex gap-3">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Type your message..." />
            <button onClick={sendMessage} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
