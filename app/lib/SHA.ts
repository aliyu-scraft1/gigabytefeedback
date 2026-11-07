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

export interface CustomerFeedbackRecord {
  id: string;
  customerId?: string;
  customerName: string;
  phone: string;
  email: string;
  conversationId: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  messages: FeedbackMessage[];
  createdAt: string;
  updatedAt: string;
  solvedAt?: string;
  archivedAt?: string;
  archiveType?: ArchiveType;
  deletedAt?: string;
  trashExpiresAt?: string;
  month?: string;
  year?: number;
  unread?: boolean;
}

export interface FeedbackDuplicateCheck {
  isDuplicate: boolean;
  similarity: number;
  matchedRecordId?: string;
  message: string;
}

export interface FeedbackAgentReply {
  conversationId: string;
  text: string;
  sender: "agent";
  createdAt: string;
}

export interface FeedbackTrashEntry {
  id: string;
  conversationId: string;
  deletedAt: string;
  expiresAt: string;
  record: CustomerFeedbackRecord;
}

export interface FeedbackHistoryFilter {
  month?: string;
  year?: number;
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  archiveType?: ArchiveType;
  search?: string;
  phone?: string;
  email?: string;
  customerName?: string;
}

export interface FeedbackMonthlyReport {
  key: string;
  label: string;
  totalFeedback: number;
  totalGoodReviews: number;
  totalBadReviews: number;
  totalComplaints: number;
  totalPraise: number;
  totalSolved: number;
  totalPending: number;
  totalArchived: number;
  records: CustomerFeedbackRecord[];
}

export interface FeedbackSystemState {
  conversations: CustomerFeedbackRecord[];
  trash: FeedbackTrashEntry[];
}

export const FEEDBACK_AGENT = {
  name: "Gigabyte Feedback Agent",
  phone: "08032534292",
  duplicateAlertText:
    "We already received similar feedback from this number. Do you need additional help with this issue?",
};

export const DEFAULT_FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "Complaint",
  "Praise / Good Review",
  "General Feedback",
  "Customer Message",
];

export const DEFAULT_FEEDBACK_STATUSES: FeedbackStatus[] = ["New", "Pending", "Solved"];

export const FEEDBACK_DUPLICATE_THRESHOLD = 0.55;

export function createFeedbackId(prefix = "fb") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeFeedbackText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateTextSimilarity(left: string, right: string) {
  const a = normalizeFeedbackText(left);
  const b = normalizeFeedbackText(right);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const aList = a.split(" ").filter(Boolean);
  const bList = b.split(" ").filter(Boolean);
  const aWords = new Set(aList);
  const bWords = new Set(bList);
  const intersection = [...aWords].filter((word) => bWords.has(word));
  const union = new Set([...aWords, ...bWords]);

  if (union.size === 0) return 0;

  const jaccard = intersection.length / union.size;
  const sharedByMinLength = intersection.length / Math.min(aList.length, bList.length || 1);
  const sharedByMaxLength = intersection.length / Math.max(aList.length, bList.length || 1);
  const sameIntentScore = aList.filter((word) => bList.includes(word)).length / Math.min(aList.length, bList.length || 1);

  return Math.max(jaccard, sharedByMinLength, sharedByMaxLength, sameIntentScore);
}

export function resolveArchiveType(category: FeedbackCategory): ArchiveType {
  return category === "Praise / Good Review" ? "Good Reviews" : "Bad Reviews";
}

export function getMonthKey(date: string | Date) {
  const currentDate = typeof date === "string" ? new Date(date) : date;
  const month = currentDate.toLocaleString("en-US", { month: "long" });
  const year = currentDate.getFullYear();
  return `${month} ${year}`;
}

export function createBlankFeedbackRecord(input: {
  customerName: string;
  phone: string;
  email: string;
  message: string;
  category?: FeedbackCategory;
}): CustomerFeedbackRecord {
  const createdAt = new Date().toISOString();
  const date = new Date(createdAt);

  return {
    id: createFeedbackId("fb"),
    customerName: input.customerName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    conversationId: createFeedbackId("conv"),
    category: input.category ?? "Customer Message",
    status: "New",
    unread: true,
    messages: [
      {
        id: createFeedbackId("msg"),
        sender: "customer",
        text: input.message.trim(),
        createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
    month: date.toLocaleString("en-US", { month: "long" }),
    year: date.getFullYear(),
  };
}

export function buildCustomerDuplicateCheck(
  candidateText: string,
  records: CustomerFeedbackRecord[],
  phone?: string,
  email?: string,
): FeedbackDuplicateCheck {
  const normalizedCandidate = normalizeFeedbackText(candidateText);

  for (const record of records) {
    const matchesCustomer =
      (!phone || record.phone === phone.trim()) &&
      (!email || record.email.toLowerCase() === email.trim().toLowerCase());

    if (!matchesCustomer) continue;

    const customerText = record.messages
      .filter((message) => message.sender === "customer")
      .map((message) => message.text)
      .join(" ");

    const similarity = calculateTextSimilarity(normalizedCandidate, customerText);
    if (similarity >= FEEDBACK_DUPLICATE_THRESHOLD) {
      return {
        isDuplicate: true,
        similarity,
        matchedRecordId: record.id,
        message: FEEDBACK_AGENT.duplicateAlertText,
      };
    }
  }

  return {
    isDuplicate: false,
    similarity: 0,
    message: "",
  };
}

export class SHAFeedbackSystem {
  private state: FeedbackSystemState;

  constructor(initialState?: Partial<FeedbackSystemState>) {
    this.state = {
      conversations: initialState?.conversations ?? [],
      trash: initialState?.trash ?? [],
    };
    this.purgeExpiredTrash();
  }

  getState(): FeedbackSystemState {
    return {
      conversations: this.state.conversations.map((record) => ({ ...record, messages: [...record.messages] })),
      trash: this.state.trash.map((entry) => ({
        ...entry,
        record: {
          ...entry.record,
          messages: [...entry.record.messages],
        },
      })),
    };
  }

  setState(nextState: FeedbackSystemState) {
    this.state = {
      conversations: nextState.conversations.map((record) => ({ ...record, messages: [...record.messages] })),
      trash: nextState.trash.map((entry) => ({
        ...entry,
        record: {
          ...entry.record,
          messages: [...entry.record.messages],
        },
      })),
    };
    this.purgeExpiredTrash();
  }

  private purgeExpiredTrash() {
    const now = Date.now();
    this.state.trash = this.state.trash.filter((entry) => new Date(entry.expiresAt).getTime() > now);
  }

  private updateConversation(
    conversationId: string,
    mutate: (conversation: CustomerFeedbackRecord) => CustomerFeedbackRecord,
  ) {
    this.state.conversations = this.state.conversations.map((conversation) =>
      conversation.id === conversationId ? mutate(conversation) : conversation,
    );
  }

  getAgentNumber() {
    return FEEDBACK_AGENT.phone;
  }

  getActiveCustomerConversations() {
    return this.state.conversations.filter((conversation) => conversation.status !== "Solved");
  }

  getPendingFeedback() {
    return this.state.conversations.filter((conversation) => conversation.status === "Pending");
  }

  getSolvedFeedback() {
    return this.state.conversations.filter((conversation) => conversation.status === "Solved");
  }

  getGoodReviewsArchive() {
    return this.getSolvedFeedback().filter((conversation) => conversation.archiveType === "Good Reviews");
  }

  getBadReviewsArchive() {
    return this.getSolvedFeedback().filter((conversation) => conversation.archiveType === "Bad Reviews");
  }

  getFeedbackHistory() {
    return [...this.state.conversations].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  getTrashEntries() {
    this.purgeExpiredTrash();
    return [...this.state.trash].sort(
      (left, right) => new Date(right.deletedAt).getTime() - new Date(left.deletedAt).getTime(),
    );
  }

  getCustomerConversationById(conversationId: string, customerPhone?: string, customerEmail?: string) {
    const record = this.state.conversations.find((conversation) => conversation.id === conversationId);
    if (!record) return null;

    if (customerPhone || customerEmail) {
      const sameCustomer =
        (!customerPhone || record.phone === customerPhone.trim()) &&
        (!customerEmail || record.email.toLowerCase() === customerEmail.trim().toLowerCase());

      if (!sameCustomer) {
        return null;
      }
    }

    return { ...record, messages: [...record.messages] };
  }

  createCustomerFeedback(input: {
    customerName: string;
    phone: string;
    email: string;
    message: string;
    category?: FeedbackCategory;
  }) {
    const trimmedName = input.customerName.trim();
    const trimmedPhone = input.phone.trim();
    const trimmedEmail = input.email.trim().toLowerCase();
    const message = input.message.trim();

    if (!trimmedName || !trimmedPhone || !trimmedEmail || !message) {
      throw new Error("Customer name, phone, email and feedback message are required.");
    }

    const duplicateCheck = buildCustomerDuplicateCheck(
      message,
      this.state.conversations,
      trimmedPhone,
      trimmedEmail,
    );

    if (duplicateCheck.isDuplicate) {
      return {
        created: false,
        duplicate: true,
        duplicateCheck,
        conversation: null,
      };
    }

    const record = createBlankFeedbackRecord({
      customerName: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
      message,
      category: input.category ?? "Customer Message",
    });

    this.state.conversations.unshift(record);
    return {
      created: true,
      duplicate: false,
      conversation: record,
      duplicateCheck,
    };
  }

  addAgentReply(conversationId: string, text: string) {
    const messageText = text.trim();
    if (!messageText) {
      throw new Error("Agent reply text is required.");
    }

    let updated: CustomerFeedbackRecord | null = null;
    this.updateConversation(conversationId, (conversation) => {
      const nextMessage: FeedbackMessage = {
        id: createFeedbackId("msg"),
        sender: "agent",
        text: messageText,
        createdAt: new Date().toISOString(),
      };

      const nextConversation: CustomerFeedbackRecord = {
        ...conversation,
        status: conversation.status === "New" ? "Pending" : conversation.status,
        unread: false,
        updatedAt: new Date().toISOString(),
        messages: [...conversation.messages, nextMessage],
      };
      updated = nextConversation;
      return nextConversation;
    });

    return updated;
  }

  addCustomerReply(conversationId: string, text: string) {
    const messageText = text.trim();
    if (!messageText) {
      throw new Error("Customer reply text is required.");
    }

    let updated: CustomerFeedbackRecord | null = null;
    this.updateConversation(conversationId, (conversation) => {
      const nextMessage: FeedbackMessage = {
        id: createFeedbackId("msg"),
        sender: "customer",
        text: messageText,
        createdAt: new Date().toISOString(),
      };

      const nextConversation: CustomerFeedbackRecord = {
        ...conversation,
        unread: true,
        updatedAt: new Date().toISOString(),
        messages: [...conversation.messages, nextMessage],
      };
      updated = nextConversation;
      return nextConversation;
    });

    return updated;
  }

  updateCategory(conversationId: string, category: FeedbackCategory) {
    let updated: CustomerFeedbackRecord | null = null;
    this.updateConversation(conversationId, (conversation) => {
      const nextConversation: CustomerFeedbackRecord = {
        ...conversation,
        category,
        updatedAt: new Date().toISOString(),
        archiveType:
          conversation.status === "Solved" ? resolveArchiveType(category) : conversation.archiveType,
      };
      updated = nextConversation;
      return nextConversation;
    });
    return updated;
  }

  markPending(conversationId: string) {
    let updated: CustomerFeedbackRecord | null = null;
    this.updateConversation(conversationId, (conversation) => {
      const nextConversation: CustomerFeedbackRecord = {
        ...conversation,
        status: "Pending",
        unread: true,
        updatedAt: new Date().toISOString(),
      };
      updated = nextConversation;
      return nextConversation;
    });
    return updated;
  }

  markSolved(conversationId: string) {
    let updated: CustomerFeedbackRecord | null = null;
    this.updateConversation(conversationId, (conversation) => {
      const solvedAt = new Date().toISOString();
      const archiveType = resolveArchiveType(conversation.category);
      const nextConversation: CustomerFeedbackRecord = {
        ...conversation,
        status: "Solved",
        unread: false,
        solvedAt,
        archivedAt: solvedAt,
        archiveType,
        updatedAt: solvedAt,
      };
      updated = nextConversation;
      return nextConversation;
    });
    return updated;
  }

  moveToTrash(conversationId: string) {
    const index = this.state.conversations.findIndex((conversation) => conversation.id === conversationId);
    if (index === -1) return null;

    const [record] = this.state.conversations.splice(index, 1);
    const deletedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const entry: FeedbackTrashEntry = {
      id: createFeedbackId("trash"),
      conversationId,
      deletedAt,
      expiresAt,
      record: {
        ...record,
        deletedAt,
        trashExpiresAt: expiresAt,
      },
    };

    this.state.trash.unshift(entry);
    return entry;
  }

  restoreFromTrash(trashId: string) {
    const index = this.state.trash.findIndex((entry) => entry.id === trashId);
    if (index === -1) return null;

    if (new Date(this.state.trash[index].expiresAt).getTime() <= Date.now()) {
      this.state.trash.splice(index, 1);
      return null;
    }

    const [entry] = this.state.trash.splice(index, 1);
    const restored = {
      ...entry.record,
      deletedAt: undefined,
      trashExpiresAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    this.state.conversations.unshift(restored);
    return restored;
  }

  permanentlyDeleteFromTrash(trashId: string) {
    const index = this.state.trash.findIndex((entry) => entry.id === trashId);
    if (index === -1) return false;
    this.state.trash.splice(index, 1);
    return true;
  }

  searchFeedback(filters: FeedbackHistoryFilter = {}) {
    const query = normalizeFeedbackText(filters.search ?? "");

    return this.state.conversations.filter((conversation) => {
      const matchesMonth = !filters.month || conversation.month === filters.month;
      const matchesYear = !filters.year || conversation.year === filters.year;
      const matchesCategory = !filters.category || conversation.category === filters.category;
      const matchesStatus = !filters.status || conversation.status === filters.status;
      const matchesArchive = !filters.archiveType || conversation.archiveType === filters.archiveType;
      const matchesPhone = !filters.phone || conversation.phone.includes(filters.phone.trim());
      const matchesEmail = !filters.email || conversation.email.includes(filters.email.trim().toLowerCase());
      const matchesName = !filters.customerName || conversation.customerName.toLowerCase().includes(filters.customerName.trim().toLowerCase());

      const textToSearch = [
        conversation.customerName,
        conversation.phone,
        conversation.email,
        conversation.category,
        conversation.status,
        conversation.messages.map((message) => message.text).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textToSearch.includes(query);

      return (
        matchesMonth &&
        matchesYear &&
        matchesCategory &&
        matchesStatus &&
        matchesArchive &&
        matchesPhone &&
        matchesEmail &&
        matchesName &&
        matchesSearch
      );
    });
  }

  buildMonthlyReports() {
    const monthMap = new Map<string, CustomerFeedbackRecord[]>();

    this.state.conversations.forEach((conversation) => {
      const key = conversation.month && conversation.year ? `${conversation.month} ${conversation.year}` : getMonthKey(conversation.createdAt);
      const list = monthMap.get(key) ?? [];
      list.push(conversation);
      monthMap.set(key, list);
    });

    const entries: FeedbackMonthlyReport[] = [...monthMap.entries()].map(([key, records]) => {
      const totalGoodReviews = records.filter(
        (item) => item.category === "Praise / Good Review" || item.archiveType === "Good Reviews",
      ).length;
      const totalBadReviews = records.filter(
        (item) => item.category === "Complaint" || item.archiveType === "Bad Reviews",
      ).length;

      return {
        key,
        label: key,
        totalFeedback: records.length,
        totalGoodReviews: totalGoodReviews,
        totalBadReviews: totalBadReviews,
        totalComplaints: records.filter((item) => item.category === "Complaint").length,
        totalPraise: records.filter((item) => item.category === "Praise / Good Review").length,
        totalSolved: records.filter((item) => item.status === "Solved").length,
        totalPending: records.filter((item) => item.status === "Pending").length,
        totalArchived: records.filter((item) => item.status === "Solved").length,
        records,
      };
    });

    return entries.sort((left, right) => {
      const leftDate = new Date(left.records[0]?.createdAt ?? Date.now()).getTime();
      const rightDate = new Date(right.records[0]?.createdAt ?? Date.now()).getTime();
      return rightDate - leftDate;
    });
  }

  getArchiveByMonth(year: number, month: string) {
    return this.state.conversations.filter(
      (conversation) => conversation.year === year && conversation.month === month && conversation.status === "Solved",
    );
  }

  getCustomerPrivateView(phoneOrEmail: string) {
    const value = phoneOrEmail.trim();
    if (!value) return [];

    return this.state.conversations.filter(
      (conversation) =>
        conversation.phone === value || conversation.email.toLowerCase() === value.toLowerCase(),
    );
  }
}

export const SHA = {
  FEEDBACK_AGENT,
  DEFAULT_FEEDBACK_CATEGORIES,
  DEFAULT_FEEDBACK_STATUSES,
  FEEDBACK_DUPLICATE_THRESHOLD,
  createFeedbackId,
  normalizeFeedbackText,
  calculateTextSimilarity,
  resolveArchiveType,
  getMonthKey,
  createBlankFeedbackRecord,
  buildCustomerDuplicateCheck,
  SHAFeedbackSystem,
};

export default SHA;
