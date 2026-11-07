"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  FEEDBACK_AGENT,
  SHAFeedbackSystem,
  type CustomerFeedbackRecord,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackSystemState,
} from "../lib/SHA";
import { readFeedbackState, writeFeedbackState } from "../data/feedback-store";

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
const FEEDBACK_AGENT_NUMBER = FEEDBACK_AGENT.phone;

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

const initialForm = {
  customerName: "",
  phone: "",
  email: "",
  message: "",
};

export default function FeedbackSystem() {
  const [activeNav, setActiveNav] = useState<(typeof NAV_ITEMS)[number]>("You");
  const [system] = useState(() => new SHAFeedbackSystem());
  const [state, setState] = useState<FeedbackSystemState>(() => system.getState());
  const [customerForm, setCustomerForm] = useState(initialForm);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [customerAgentReply, setCustomerAgentReply] = useState("");
  const [search, setSearch] = useState("");
  const [duplicateAlert, setDuplicateAlert] = useState<{
    conversationId: string;
    action: "continue" | "different" | "cancel";
  } | null>(null);

  useEffect(() => {
    const saved = readFeedbackState() as unknown as FeedbackSystemState;
    system.setState({
      conversations: (saved.conversations ?? []) as CustomerFeedbackRecord[],
      trash: (saved.trash ?? []) as typeof state.trash,
    });
    setState(system.getState());
    setSelectedConversationId((saved.conversations ?? [])[0]?.id ?? null);
  }, [system]);

  useEffect(() => {
    writeFeedbackState(state as any);
  }, [state]);

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
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, state.conversations]);

  const activeConversations = useMemo(() => {
    return filteredConversations.filter(
      (conversation) => !conversation.deletedAt && conversation.status !== "Solved",
    );
  }, [filteredConversations, state.conversations]);

  const pendingConversations = useMemo(
    () => filteredConversations.filter((conversation) => conversation.status === "Pending"),
    [filteredConversations],
  );

  const solvedConversations = useMemo(
    () => filteredConversations.filter((conversation) => conversation.status === "Solved"),
    [filteredConversations],
  );

  const goodReviews = useMemo(
    () => solvedConversations.filter((conversation) => conversation.archiveType === "Good Reviews"),
    [solvedConversations],
  );

  const badReviews = useMemo(
    () => solvedConversations.filter((conversation) => conversation.archiveType === "Bad Reviews"),
    [solvedConversations],
  );

  const trash = useMemo(
    () => state.trash.filter((item) => new Date(item.expiresAt).getTime() > Date.now()),
    [state.trash],
  );

  const selectedConversation = useMemo(
    () => filteredConversations.find((conversation) => conversation.id === selectedConversationId) ?? filteredConversations[0] ?? null,
    [filteredConversations, selectedConversationId],
  );

  const monthlyReports = useMemo(() => system.buildMonthlyReports(), [state.conversations]);

  const customerSendFeedback = () => {
    const { customerName, phone, email, message } = customerForm;
    if (!customerName.trim() || !phone.trim() || !email.trim() || !message.trim()) {
      return;
    }

    const result = system.createCustomerFeedback({
      customerName,
      phone,
      email,
      message,
    });

    if (!result.created && result.duplicate) {
      setDuplicateAlert({
        conversationId: result.duplicateCheck.matchedRecordId ?? "",
        action: "continue",
      });
      return;
    }

    setState(system.getState());
    setSelectedConversationId(result.conversation?.id ?? null);
    setCustomerForm(initialForm);
    setDuplicateAlert(null);
  };

  const sendAgentReply = () => {
    if (!selectedConversation || !customerAgentReply.trim()) return;

    system.addAgentReply(selectedConversation.id, customerAgentReply.trim());
    setState(system.getState());
    setCustomerAgentReply("");
  };

  const markSolved = (conversationId: string) => {
    system.markSolved(conversationId);
    setState(system.getState());
  };

  const markPending = (conversationId: string) => {
    system.markPending(conversationId);
    setState(system.getState());
  };

  const updateCategory = (conversationId: string, category: FeedbackCategory) => {
    system.updateCategory(conversationId, category);
    setState(system.getState());
  };

  const moveToTrash = (conversationId: string) => {
    system.moveToTrash(conversationId);
    setState(system.getState());
  };

  const restoreFromTrash = (trashId: string) => {
    system.restoreFromTrash(trashId);
    setState(system.getState());
  };

  const renderActions = (conversation: CustomerFeedbackRecord) => (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => markPending(conversation.id)}
        className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
      >
        Pending
      </button>
      <button
        onClick={() => markSolved(conversation.id)}
        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Solved
      </button>
      <button
        onClick={() => moveToTrash(conversation.id)}
        className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
      >
        Delete
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-200">
              <Image src="/gigabyte-logo.svg" alt="Gigabyte logo" width={44} height={44} className="h-11 w-11 object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Gigabyte</p>
              <h1 className="text-xl font-bold text-slate-900">{FEEDBACK_AGENT_NUMBER}</h1>
            </div>
          </div>
          <div className="w-full max-w-md">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, phone, email, category, message..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
            />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_360px]">
          <aside className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-white/5 p-2">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                <Image src="/gigabyte-logo.svg" alt="Gigabyte logo" width={36} height={36} className="h-9 w-9 object-contain" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Gigabyte</p>
                <h2 className="text-sm font-semibold">Feedback Desk</h2>
              </div>
            </div>
            <nav className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item}
                  onClick={() => setActiveNav(item)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                    activeNav === item ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span>{item}</span>
                  {item === "Pending" && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] text-slate-900">{pendingConversations.length}</span>}
                  {item === "Solved" && <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] text-slate-900">{solvedConversations.length}</span>}
                </button>
              ))}
            </nav>
          </aside>

          <main className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            {activeNav === "You" && (
              <div className="space-y-4">
                {activeConversations.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No active conversations.</div>
                ) : (
                  activeConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        selectedConversation?.id === conversation.id
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => setSelectedConversationId(conversation.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">{conversation.customerName}</h2>
                            {conversation.unread && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
                          </div>
                          <p className="text-sm text-slate-500">{conversation.phone}</p>
                          <p className="text-xs text-slate-500">{conversation.email}</p>
                        </div>
                        <span className="text-xs text-slate-500">{formatRelativeTime(conversation.updatedAt)}</span>
                      </div>

                      <p className="mt-3 text-sm text-slate-600">
                        {conversation.messages[conversation.messages.length - 1]?.text}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1">{conversation.category}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">{conversation.status}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">{formatDateTime(conversation.updatedAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Pending" && (
              <div className="space-y-3">
                {pendingConversations.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No pending feedback.</div>
                ) : (
                  pendingConversations.map((conversation) => (
                    <div key={conversation.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{conversation.customerName}</p>
                          <p className="text-xs text-slate-500">{conversation.phone}</p>
                        </div>
                        <span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          Pending
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                      {renderActions(conversation)}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Solved" && (
              <div className="space-y-3">
                {solvedConversations.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No solved feedback.</div>
                ) : (
                  solvedConversations.map((conversation) => (
                    <div key={conversation.id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{conversation.customerName}</p>
                          <p className="text-xs text-slate-500">{conversation.category}</p>
                        </div>
                        <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          Solved
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Archive" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold">Good Reviews</h3>
                  <p className="mt-2 text-sm text-slate-500">{goodReviews.length} records</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <h3 className="font-semibold">Bad Reviews</h3>
                  <p className="mt-2 text-sm text-slate-500">{badReviews.length} records</p>
                </div>
              </div>
            )}

            {activeNav === "Good Reviews" && (
              <div className="space-y-3">
                {goodReviews.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No good reviews archived.</div>
                ) : (
                  goodReviews.map((conversation) => (
                    <div key={conversation.id} className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="font-semibold">{conversation.customerName}</p>
                      <p className="mt-1 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Bad Reviews" && (
              <div className="space-y-3">
                {badReviews.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No bad reviews archived.</div>
                ) : (
                  badReviews.map((conversation) => (
                    <div key={conversation.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <p className="font-semibold">{conversation.customerName}</p>
                      <p className="mt-1 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Feedback History" && (
              <div className="space-y-3">
                {state.conversations.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No feedback history yet.</div>
                ) : (
                  state.conversations.map((conversation) => (
                    <div key={conversation.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{conversation.customerName}</p>
                        <span className="text-xs text-slate-500">{conversation.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Monthly Reports" && (
              <div className="space-y-4">
                {monthlyReports.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">No monthly reports yet.</div>
                ) : (
                  monthlyReports.map((report) => (
                    <div key={report.key} className="rounded-xl border border-slate-200 p-4">
                      <h3 className="text-lg font-semibold">{report.label}</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Total feedback</p><p className="text-xl font-bold">{report.totalFeedback}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Good reviews</p><p className="text-xl font-bold">{report.totalGoodReviews}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Bad reviews</p><p className="text-xl font-bold">{report.totalBadReviews}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Solved</p><p className="text-xl font-bold">{report.totalSolved}</p></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Trash" && (
              <div className="space-y-3">
                {trash.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">Trash is empty.</div>
                ) : (
                  trash.map((item) => (
                    <div key={item.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{item.record.customerName}</p>
                          <p className="text-xs text-slate-500">Deleted {formatDateTime(item.deletedAt)}</p>
                        </div>
                        <button
                          onClick={() => restoreFromTrash(item.id)}
                          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Restore
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{item.record.messages[item.record.messages.length - 1]?.text}</p>
                      <p className="mt-3 text-xs font-medium text-red-700">
                        {Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeNav === "Settings" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                Gigabyte Feedback Agent phone number: <strong>08032534292</strong>
              </div>
            )}
          </main>

          <aside className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            {selectedConversation ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedConversation.customerName}</h2>
                    <p className="text-xs text-slate-500">{selectedConversation.phone}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    {selectedConversation.status}
                  </span>
                </div>

                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
                  <select
                    value={selectedConversation.category}
                    onChange={(event) => updateCategory(selectedConversation.id, event.target.value as FeedbackCategory)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                  <select
                    value={selectedConversation.status}
                    onChange={(event) => {
                      const value = event.target.value as FeedbackStatus;
                      if (value === "Solved") markSolved(selectedConversation.id);
                      if (value === "Pending") markPending(selectedConversation.id);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        message.sender === "customer"
                          ? "bg-slate-100 text-slate-800"
                          : "ml-auto bg-slate-900 text-white"
                      }`}
                    >
                      <p>{message.text}</p>
                      <p className={`mt-1 text-[10px] ${message.sender === "customer" ? "text-slate-500" : "text-slate-300"}`}>
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={customerAgentReply}
                    onChange={(event) => setCustomerAgentReply(event.target.value)}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    placeholder="Reply as the Gigabyte Feedback Agent..."
                  />
                  <button
                    onClick={sendAgentReply}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Send Reply
                  </button>
                </div>

                {renderActions(selectedConversation)}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Select a conversation.</div>
            )}
          </aside>
        </div>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Gigabyte</p>
              <h2 className="text-2xl font-bold">Customer DM</h2>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input
                value={customerForm.customerName}
                onChange={(event) => setCustomerForm((current) => ({ ...current, customerName: event.target.value }))}
                placeholder="Your name"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={customerForm.phone}
                onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Phone number"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={customerForm.email}
                onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email address"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <textarea
                value={customerForm.message}
                onChange={(event) => setCustomerForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Type your feedback message..."
                className="min-h-32 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={customerSendFeedback}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Send Feedback
              </button>

              {duplicateAlert && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p>We already received similar feedback from this number. Do you need additional help with this issue?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setSelectedConversationId(duplicateAlert.conversationId);
                        setActiveNav("You");
                        setDuplicateAlert(null);
                      }}
                      className="rounded-full bg-amber-600 px-3 py-1.5 font-medium text-white"
                    >
                      I NEED MORE HELP
                    </button>
                    <button
                      onClick={() => {
                        setDuplicateAlert(null);
                        setCustomerForm((current) => ({ ...current, message: "" }));
                      }}
                      className="rounded-full bg-slate-900 px-3 py-1.5 font-medium text-white"
                    >
                      SEND DIFFERENT FEEDBACK
                    </button>
                    <button
                      onClick={() => {
                        setDuplicateAlert(null);
                        setCustomerForm(initialForm);
                      }}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Conversation Preview</h3>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase text-slate-700">DM</span>
              </div>
              <div className="space-y-3">
                {state.conversations.slice(0, 4).map((conversation) => (
                  <div key={conversation.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{conversation.customerName}</span>
                      <span className="text-[10px] text-slate-500">{conversation.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{conversation.messages[conversation.messages.length - 1]?.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
