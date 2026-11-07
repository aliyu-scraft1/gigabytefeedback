import { getDefaultState, type FeedbackConversation, type FeedbackState } from "../lib/feedback-system";

const STORAGE_KEY = "feedback-system-v1";

export function readFeedbackState(): FeedbackState {
  if (typeof window === "undefined") {
    return getDefaultState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return getDefaultState();
  }

  try {
    const parsed = JSON.parse(raw) as FeedbackState;
    return parsed && Array.isArray(parsed.conversations) ? parsed : getDefaultState();
  } catch {
    return getDefaultState();
  }
}

export function writeFeedbackState(state: FeedbackState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function seedSampleFeedback(): FeedbackConversation[] {
  const now = new Date();
  return [
    {
      id: "conv-sample-1",
      customerName: "Ada Johnson",
      phone: "08032534292",
      email: "ada@example.com",
      category: "Complaint",
      status: "Pending",
      unread: true,
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      messages: [
        {
          id: "msg-sample-1",
          sender: "customer",
          text: "The staff were rude and ignored me at the counter.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
        },
        {
          id: "msg-sample-2",
          sender: "agent",
          text: "We are sorry about that. We are looking into it.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
        },
      ],
    },
    {
      id: "conv-sample-2",
      customerName: "David Cole",
      phone: "08020000001",
      email: "david@example.com",
      category: "Praise / Good Review",
      status: "Solved",
      unread: false,
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      solvedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      archiveType: "Good Reviews",
      archivedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      messages: [
        {
          id: "msg-sample-3",
          sender: "customer",
          text: "The team was very helpful and the service was excellent.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        },
        {
          id: "msg-sample-4",
          sender: "agent",
          text: "Thank you for your kind words. We truly appreciate your support.",
          createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        },
      ],
    },
  ];
}
