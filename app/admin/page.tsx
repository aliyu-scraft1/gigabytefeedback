"use client";

import { useRouter } from "next/navigation";
import { SHAFeedbackSystem, type FeedbackCategory, type FeedbackStatus, type FeedbackSystemState } from "../lib/SHA";
import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "gigabyte-feedback-system-v1";

function readStoredState(): FeedbackSystemState {
  if (typeof window === "undefined") {
    return { conversations: [], trash: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversations: [], trash: [] };
    const parsed = JSON.parse(raw) as FeedbackSystemState;
    if (!parsed || !Array.isArray(parsed.conversations)) return { conversations: [], trash: [] };

    const trash = (Array.isArray(parsed.trash) ? parsed.trash : [])
      .map((entry) => {
        const deletedAt = Date.parse(entry.deletedAt);
        if (!Number.isFinite(deletedAt)) return entry;
        const expiresAt = new Date(deletedAt + 5 * 24 * 60 * 60 * 1000).toISOString();
        return { ...entry, expiresAt, record: { ...entry.record, trashExpiresAt: expiresAt } };
      })
      .filter((entry) => Date.parse(entry.expiresAt) > Date.now());

    return { conversations: parsed.conversations, trash };
  } catch {
    return { conversations: [], trash: [] };
  }
}

function mergeInboxState(serverState: FeedbackSystemState, localState: FeedbackSystemState): FeedbackSystemState {
  const localById = new Map(localState.conversations.map((conversation) => [conversation.id, conversation]));
  const serverIds = new Set(serverState.conversations.map((conversation) => conversation.id));
  const serverTrashIds = new Set(serverState.trash.map((entry) => entry.id));
  const conversations = serverState.conversations.map((conversation) => {
    const local = localById.get(conversation.id);
    if (!local) return conversation;

    const messageIds = new Set(conversation.messages.map((message) => message.id));
    const localAgentMessages = local.messages.filter(
      (message) => message.sender === "agent" && !messageIds.has(message.id),
    );
    return {
      ...conversation,
      category: local.category,
      status: local.status,
      archiveType: local.archiveType,
      unread: conversation.unread || local.unread,
      messages: [...conversation.messages, ...localAgentMessages],
    };
  });

  return {
    conversations: [...conversations, ...localState.conversations.filter((conversation) => !serverIds.has(conversation.id))],
    trash: [...serverState.trash, ...localState.trash.filter((entry) => !serverTrashIds.has(entry.id))],
  };
}

const NAV_ITEMS = [
  "You",
  "Messages",
  "Pending",
  "Solved",
  "Archive",
  "Good Reviews",
  "Bad Reviews",
  "Feedback History",
  "Monthly Reports",
  "Trash",
  "Settings",
] as const;

const categoryOptions: FeedbackCategory[] = [
  "Complaint",
  "Praise / Good Review",
  "General Feedback",
  "Customer Message",
];

const statuses: FeedbackStatus[] = ["New", "Pending", "Solved"];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseCustomerFeedbackMessage(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);

  const data = {
    purpose: "",
    problem: "",
    happened: "",
    rating: 0,
    additional: "",
  };

  for (const line of lines) {
    if (line.startsWith("Purpose:")) {
      data.purpose = line.replace(/^Purpose:\s*/i, "").trim();
      continue;
    }

    if (line.startsWith("Problem:")) {
      data.problem = line.replace(/^Problem:\s*/i, "").trim();
      continue;
    }

    if (line.startsWith("What happened:")) {
      data.happened = line.replace(/^What happened:\s*/i, "").trim();
      continue;
    }

    if (line.startsWith("Rating:")) {
      const match = line.match(/(\d)(?:\s*\/\s*5)?/i);
      if (match) {
        data.rating = Number.parseInt(match[1], 10) || 0;
      }
      continue;
    }

    if (line.startsWith("Additional feedback:")) {
      data.additional = line.replace(/^Additional feedback:\s*/i, "").trim();
    }
  }

  if (!data.purpose || !data.happened) {
    const combinedMatch = normalized.match(/Purpose:\s*([\s\S]*?)(?:\n|\s+)Problem:\s*([\s\S]*?)(?:\n|\s+)What happened:\s*([\s\S]*?)(?:\n|\s+)Rating:\s*(\d)(?:\/5)?(?:\n|\s+)Additional feedback:\s*([\s\S]*)/i);

    if (combinedMatch) {
      data.purpose = combinedMatch[1]?.trim() ?? data.purpose;
      data.problem = combinedMatch[2]?.trim() ?? data.problem;
      data.happened = combinedMatch[3]?.trim() ?? data.happened;
      data.rating = Number.parseInt(combinedMatch[4] ?? "0", 10) || data.rating;
      data.additional = combinedMatch[5]?.trim() ?? data.additional;
    }
  }

  return data;
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (
    <span key={index} className={index < rating ? "text-yellow-400" : "text-slate-300"}>★</span>
  ));
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState<(typeof NAV_ITEMS)[number]>("You");
  const [state, setState] = useState(() => new SHAFeedbackSystem(readStoredState()).getState());
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(state.conversations[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [newReply, setNewReply] = useState("");
  const [persistenceError, setPersistenceError] = useState("");
  const pendingSaves = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    const refreshInbox = async () => {
      if (pendingSaves.current > 0) return;
      try {
        const response = await fetch("/api/admin/conversations", { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!response.ok) {
          const result = (await response.json().catch(() => ({}))) as { error?: string };
          setPersistenceError(result.error || "The feedback database could not be loaded.");
          return;
        }
        const result = (await response.json()) as { state?: FeedbackSystemState };
        if (!active || pendingSaves.current > 0 || !result.state || !Array.isArray(result.state.conversations)) return;

        const merged = mergeInboxState(result.state, readStoredState());
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setState(merged);
        setPersistenceError("");
      } catch {
        if (active) setPersistenceError("The feedback database could not be reached. Changes may only be stored in this browser.");
      }
    };

    void refreshInbox();
    const interval = window.setInterval(refreshInbox, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [router]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return state.conversations.filter((conversation) => {
      if (!query) return true;
      const haystack = [
        conversation.customerName,
        conversation.phone,
        conversation.email,
        conversation.category,
        conversation.status,
        conversation.messages.map((message) => message.text).join(" "),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [search, state.conversations]);

  const activeConversations = filteredConversations.filter((conversation) => conversation.status !== "Solved");
  const pendingConversations = filteredConversations.filter((conversation) => conversation.status === "Pending");
  const solvedConversations = filteredConversations.filter((conversation) => conversation.status === "Solved");
  const goodReviews = solvedConversations.filter((conversation) => conversation.archiveType === "Good Reviews");
  const badReviews = solvedConversations.filter((conversation) => conversation.archiveType === "Bad Reviews");
  const monthlyReports = useMemo(() => new SHAFeedbackSystem(state).buildMonthlyReports(), [state]);
  const selectedConversation = filteredConversations.find((conversation) => conversation.id === selectedConversationId) ?? filteredConversations[0] ?? null;
  const selectedCustomerMessage = selectedConversation
    ? [...selectedConversation.messages].reverse().find((message) => message.sender === "customer") ?? null
    : null;
  const selectedStructuredFeedback = selectedCustomerMessage
    ? parseCustomerFeedbackMessage(selectedCustomerMessage.text)
    : null;

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  function updateState(nextSystem: SHAFeedbackSystem) {
    const nextState = nextSystem.getState();
    setState(nextState);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    setPersistenceError("");
    pendingSaves.current += 1;

    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        const response = await fetch("/api/admin/conversations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: nextState }),
        });
        if (response.status === 401) {
          router.replace("/admin/login");
          throw new Error("Your session expired. Sign in again to save feedback changes.");
        }
        if (!response.ok) {
          const result = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(result.error || "The feedback changes could not be saved to the database.");
        }
      })
      .catch((error: unknown) => {
        setPersistenceError(error instanceof Error ? error.message : "The feedback changes could not be saved to the database.");
      })
      .finally(() => {
        pendingSaves.current -= 1;
      });
  }

  function markPending(id: string) {
    const next = new SHAFeedbackSystem(state);
    next.markPending(id);
    updateState(next);
  }

  function markSolved(id: string) {
    const next = new SHAFeedbackSystem(state);
    next.markSolved(id);
    updateState(next);
  }

  function updateCategory(id: string, category: FeedbackCategory) {
    const next = new SHAFeedbackSystem(state);
    next.updateCategory(id, category);
    updateState(next);
  }

  function moveToTrash(id: string) {
    const next = new SHAFeedbackSystem(state);
    next.moveToTrash(id);
    updateState(next);
  }

  function restoreFromTrash(id: string) {
    const next = new SHAFeedbackSystem(state);
    const restored = next.restoreFromTrash(id);
    updateState(next);
    if (restored) setSelectedConversationId(restored.id);
  }

  function sendReply() {
    if (!selectedConversation || !newReply.trim()) return;
    const next = new SHAFeedbackSystem(state);
    next.addAgentReply(selectedConversation.id, newReply.trim());
    updateState(next);
    setNewReply("");
  }

  function renderActions(conversation: (typeof state.conversations)[number]) {
    return (
      <div className="flex flex-wrap gap-2">
        <button onClick={() => markPending(conversation.id)} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">Pending</button>
        <button onClick={() => markSolved(conversation.id)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Solved</button>
        <button onClick={() => moveToTrash(conversation.id)} className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">Delete</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-400">Gigabyte</p>
            <h1 className="text-xl font-bold">Feedback Agent Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers..."
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none"
            />
            <button onClick={logout} className="rounded-xl bg-red-500 px-3 py-2 text-sm font-semibold text-white">Logout</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)_380px]">
        <aside className="rounded-2xl bg-slate-900 p-4 text-white">
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => setActiveNav(item)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${activeNav === item ? "bg-white/10" : "text-slate-300 hover:bg-white/5"}`}
              >
                <span>{item}</span>
                {item === "Pending" && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] text-slate-900">{pendingConversations.length}</span>}
                {item === "Solved" && <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] text-slate-900">{solvedConversations.length}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <main className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {persistenceError && <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{persistenceError} The latest change is only stored in this browser until the database connection is fixed.</p>}
          {activeNav === "You" && (
            <div className="space-y-4">
              {activeConversations.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No active conversations.</div> : activeConversations.map((conversation) => (
                <div key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={`cursor-pointer rounded-2xl border p-4 ${selectedConversation?.id === conversation.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{conversation.customerName}</h2>{conversation.unread && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}</div>
                      <p className="text-sm text-slate-500">{conversation.phone}</p>
                    </div>
                    <span className="text-xs text-slate-500">{formatRelativeTime(conversation.updatedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1">{conversation.category}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">{conversation.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeNav === "Pending" && (
            <div className="space-y-3">{pendingConversations.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No pending feedback.</div> : pendingConversations.map((conversation) => (
              <div key={conversation.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{conversation.customerName}</p><p className="text-xs text-slate-500">{conversation.phone}</p></div><span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase text-white">Pending</span></div>
                <p className="mt-2 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                {renderActions(conversation)}
              </div>
            ))}</div>
          )}

          {activeNav === "Solved" && (
            <div className="space-y-3">{solvedConversations.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No solved feedback.</div> : solvedConversations.map((conversation) => (
              <div key={conversation.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{conversation.customerName}</p><p className="text-xs text-slate-500">{conversation.category}</p></div><span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase text-white">Solved</span></div>
                <p className="mt-2 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p>
              </div>
            ))}</div>
          )}

          {activeNav === "Good Reviews" && (
            <div className="space-y-3">{goodReviews.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No good reviews.</div> : goodReviews.map((conversation) => (
              <div key={conversation.id} className="rounded-xl border border-green-200 bg-green-50 p-4"><p className="font-semibold">{conversation.customerName}</p><p className="mt-1 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p></div>
            ))}</div>
          )}

          {activeNav === "Bad Reviews" && (
            <div className="space-y-3">{badReviews.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No bad reviews.</div> : badReviews.map((conversation) => (
              <div key={conversation.id} className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold">{conversation.customerName}</p><p className="mt-1 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p></div>
            ))}</div>
          )}

          {activeNav === "Feedback History" && (
            <div className="space-y-3">{state.conversations.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No history.</div> : state.conversations.map((conversation) => (
              <div key={conversation.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{conversation.customerName}</p><span className="text-xs text-slate-500">{conversation.status}</span></div><p className="mt-2 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p></div>
            ))}</div>
          )}

          {activeNav === "Monthly Reports" && (
            <div className="space-y-4">{monthlyReports.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No monthly reports yet.</div> : monthlyReports.map((report) => (
              <div key={report.key} className="rounded-xl border border-slate-200 p-4"><h3 className="text-lg font-semibold">{report.label}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Total feedback</p><p className="text-xl font-bold">{report.totalFeedback}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Good reviews</p><p className="text-xl font-bold">{report.totalGoodReviews}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Bad reviews</p><p className="text-xl font-bold">{report.totalBadReviews}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Solved</p><p className="text-xl font-bold">{report.totalSolved}</p></div></div></div>
            ))}</div>
          )}

          {activeNav === "Trash" && (
            <div className="space-y-3">
              {state.trash.length === 0 ? <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">Trash is empty.</div> : state.trash.map((item) => (
                <div key={item.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.record.customerName}</p><p className="text-xs text-slate-500">Deleted {formatDateTime(item.deletedAt)} · permanently removed after {formatDateTime(item.expiresAt)}</p></div><button onClick={() => restoreFromTrash(item.id)} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Restore</button></div>
                  <p className="mt-2 text-sm text-slate-700">{item.record.messages[item.record.messages.length - 1]?.text}</p>
                </div>
              ))}
            </div>
          )}

          {activeNav === "Settings" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Gigabyte Feedback Agent phone number: <strong>08032534292</strong></div>
          )}
        </main>

        <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          {selectedConversation ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">{selectedConversation.customerName}</h2><p className="text-xs text-slate-500">{selectedConversation.phone}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-700">{selectedConversation.status}</span></div>
              <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
                <select value={selectedConversation.category} onChange={(event) => updateCategory(selectedConversation.id, event.target.value as FeedbackCategory)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                <select value={selectedConversation.status} onChange={(event) => { const value = event.target.value as FeedbackStatus; if (value === "Solved") markSolved(selectedConversation.id); if (value === "Pending") markPending(selectedConversation.id); }} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-lg font-bold uppercase tracking-wide text-slate-800">Customer Feedback</h3>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Customer Name</p>
                  <p className="mt-2 text-sm text-slate-800">{selectedConversation.customerName}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Phone Number</p>
                  <p className="mt-2 text-sm text-slate-800">{selectedConversation.phone}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Email</p>
                  <p className="mt-2 text-sm text-slate-800">{selectedConversation.email}</p>
                </div>

                {selectedStructuredFeedback && (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">What did you come to Gigabyte for?</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedStructuredFeedback.purpose || "—"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">What problem did you experience?</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedStructuredFeedback.problem || "—"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">What happened?</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedStructuredFeedback.happened || "—"}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">How would you rate your experience?</p>
                      <div className="mt-2 flex items-center gap-2 text-2xl">
                        {renderStars(selectedStructuredFeedback.rating || 0)}
                        <span className="ml-2 text-sm font-semibold text-slate-700">{selectedStructuredFeedback.rating || 0}/5</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Additional feedback</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selectedStructuredFeedback.additional || "—"}</p>
                    </div>
                  </>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Date</p>
                  <p className="mt-2 text-sm text-slate-800">{formatDateTime(selectedConversation.createdAt)}</p>
                </div>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {selectedConversation.messages.map((message) => (
                  <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.sender === "customer" ? "bg-slate-100 text-slate-800" : "ml-auto bg-slate-900 text-white"}`}>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                    <p className={`mt-1 text-[10px] ${message.sender === "customer" ? "text-slate-500" : "text-slate-300"}`}>{formatDateTime(message.createdAt)}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2"><textarea value={newReply} onChange={(event) => setNewReply(event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Reply as the Gigabyte Feedback Agent..." /><button onClick={sendReply} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Send Reply</button></div>
              {renderActions(selectedConversation)}
            </div>
          ) : <div className="text-sm text-slate-500">Select a conversation.</div>}
        </aside>
      </div>
    </div>
  );
}
