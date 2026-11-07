export type FeedbackCategory =
  | "Complaint"
  | "Praise / Good Review"
  | "General Feedback"
  | "Customer Message";

export type FeedbackStatus = "New" | "Pending" | "Solved";
export type ArchiveType = "Good Reviews" | "Bad Reviews";

export type MessageSender = "customer" | "agent";

export interface FeedbackMessage {
  id: string;
  sender: MessageSender;
  text: string;
  createdAt: string;
}

export interface FeedbackConversation {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  unread: boolean;
  createdAt: string;
  updatedAt: string;
  solvedAt?: string;
  archiveType?: ArchiveType;
  archivedAt?: string;
  deletedAt?: string;
  trashExpiresAt?: string;
  messages: FeedbackMessage[];
}

export interface TrashItem {
  id: string;
  conversationId: string;
  deletedAt: string;
  expiresAt: string;
  conversation: FeedbackConversation;
}

export interface FeedbackState {
  conversations: FeedbackConversation[];
  trash: TrashItem[];
}

export const FEEDBACK_AGENT_NUMBER = "08032534292";

export const NAV_ITEMS = [
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

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
}

export function getMonthKey(dateValue: string) {
  const date = new Date(dateValue);
  return `${getMonthLabel(date)} ${date.getFullYear()}`;
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeTextSimilarity(left: string, right: string) {
  const a = normalizeText(left);
  const b = normalizeText(right);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter((word) => bTokens.has(word));
  const union = new Set([...aTokens, ...bTokens]);

  if (union.size === 0) return 0;

  const jaccard = intersection.length / union.size;
  if (jaccard >= 0.6) return jaccard;

  const aWords = a.split(" ");
  const bWords = b.split(" ");
  const commonWords = aWords.filter((word) => bWords.includes(word));

  return commonWords.length / Math.max(aWords.length, bWords.length);
}

export function buildMonthlyReports(conversations: FeedbackConversation[]) {
  const monthMap = new Map<string, FeedbackConversation[]>();

  conversations.forEach((item) => {
    const key = getMonthKey(item.createdAt || new Date().toISOString());
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)?.push(item);
  });

  return [...monthMap.entries()]
    .map(([monthKeyValue, items]) => {
      const goodReviews = items.filter(
        (item) => item.category === "Praise / Good Review" || item.archiveType === "Good Reviews",
      ).length;
      const badReviews = items.filter(
        (item) => item.category === "Complaint" || item.archiveType === "Bad Reviews",
      ).length;

      return {
        monthKey: monthKeyValue,
        totalFeedback: items.length,
        goodReviews,
        badReviews,
        totalSolved: items.filter((item) => item.status === "Solved").length,
        totalPending: items.filter((item) => item.status === "Pending").length,
        totalArchived: items.filter((item) => item.status === "Solved").length,
        items,
      };
    })
    .sort((left, right) => {
      const leftDate = new Date(left.items[0]?.createdAt ?? Date.now()).getTime();
      const rightDate = new Date(right.items[0]?.createdAt ?? Date.now()).getTime();
      return rightDate - leftDate;
    });
}

export function getDefaultState(): FeedbackState {
  return {
    conversations: [],
    trash: [],
  };
}

export function applyActiveTrashPolicy(trashItems: TrashItem[]) {
  const now = Date.now();
  return trashItems.filter((item) => new Date(item.expiresAt).getTime() > now);
}

export function resolveArchiveType(category: FeedbackCategory) {
  if (category === "Praise / Good Review") return "Good Reviews";
  return "Bad Reviews";
}
