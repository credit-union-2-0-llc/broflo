import type { Person, NeverAgainItem, PersonTag, WishlistItem, CreatePersonData } from "@broflo/shared";

export interface BrofloEvent {
  id: string;
  personId: string;
  userId: string;
  name: string;
  occasionType: string;
  date: string;
  isRecurring: boolean;
  recurrenceRule: string;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  notes: string | null;
  isAutoCreated: boolean;
  userModified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingEvent extends BrofloEvent {
  personName: string;
  nextOccurrence: string;
  daysUntil: number;
}

export interface UpcomingEventsResponse {
  data: UpcomingEvent[];
  meta: { page: number; limit: number; total: number };
}

export interface CreateEventData {
  name: string;
  date: string;
  occasionType: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  budgetMinCents?: number;
  budgetMaxCents?: number;
  notes?: string;
}

export interface Reminder {
  id: string;
  eventId: string;
  userId: string;
  leadDays: number;
  scheduledFor: string;
  dismissedAt: string | null;
  createdAt: string;
  event: {
    id: string;
    name: string;
    occasionType: string;
    date: string;
    personId: string;
    person: { name: string };
  };
}

// S-4 Suggestion types
export interface GiftSuggestion {
  id: string;
  personId: string;
  eventId: string;
  title: string;
  description: string;
  estimatedPriceMinCents: number;
  estimatedPriceMaxCents: number;
  reasoning: string;
  confidenceScore: number;
  delightScore: number;
  noveltyScore: number;
  retailerHint: string | null;
  suggestedMessage: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  productSourcePriceCents: number | null;
  requestIndex: number;
  surpriseFactor: "safe" | "bold";
  isSelected: boolean;
  isDismissed: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface SuggestionsResponse {
  suggestions: GiftSuggestion[];
  meta: {
    cached: boolean;
    tier: string;
    model: string;
    requestIndex: number;
    budgetApplied: { minCents: number; maxCents: number; source: string };
  };
}

export interface EventSuggestionsResponse {
  suggestions: GiftSuggestion[];
  meta: { requestIndex: number; total: number; dismissed: number };
}

export interface SuggestionMetaResponse {
  eventId: string;
  requestCount: number;
  maxRequests: number;
  canReroll: boolean;
  sets: Array<{
    requestIndex: number;
    suggestionCount: number;
    surpriseFactor: string;
    createdAt: string;
  }>;
}

export interface SelectSuggestionResponse {
  suggestion: GiftSuggestion;
  giftRecord: Record<string, unknown>;
  scoreChange: number;
}

// S-5 Gift History types
export interface GiftRecord {
  id: string;
  personId: string;
  eventId: string | null;
  userId: string;
  suggestionId: string | null;
  title: string;
  description: string | null;
  priceCents: number | null;
  givenAt: string;
  rating: number | null;
  feedbackNote: string | null;
  imageUrl: string | null;
  source: "suggestion" | "manual" | "ordered";
  suggestionSnapshot: {
    title: string;
    estimatedPriceMinCents: number;
    estimatedPriceMaxCents: number;
    reasoning: string;
    confidenceScore: number;
  } | null;
  feedbackScored: boolean;
  createdAt: string;
  updatedAt: string;
}

// S-7 Order types
export interface RetailerProduct {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  estimatedDeliveryDays: number;
  retailerHint: string;
}

export interface OrderPreviewResponse {
  product: RetailerProduct;
  suggestion: { id: string; title: string; description: string };
  person: {
    id: string;
    name: string;
    shippingAddress1: string | null;
    shippingAddress2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingZip: string | null;
  };
  cancelWindowHours: number;
}

export interface Order {
  id: string;
  userId: string;
  personId: string;
  eventId: string | null;
  giftRecordId: string | null;
  suggestionId: string | null;
  retailerKey: string;
  retailerProductId: string;
  retailerOrderId: string | null;
  confirmationNumber: string | null;
  productTitle: string;
  productDescription: string | null;
  productImageUrl: string | null;
  priceCents: number;
  platformFeeCents: number;
  stripePaymentIntentId: string | null;
  status: 'pending' | 'ordered' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed';
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierName: string | null;
  deliveredAt: string | null;
  estimatedDeliveryDate: string | null;
  placedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetailResponse extends Order {
  cancelWindowSecondsLeft: number;
  person: { name: string };
  giftRecord: { id: string; title: string; source: string } | null;
}

export interface OrderListResponse {
  data: Array<Order & { person: { name: string } }>;
  meta: { page: number; limit: number; total: number };
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  source: 'system' | 'webhook' | 'manual';
  metadata: Record<string, unknown> | null;
  changedAt: string;
}

// S-10 Agent types
export interface AgentJob {
  id: string;
  userId: string;
  orderId: string | null;
  suggestionId: string | null;
  status: 'queued' | 'running' | 'previewing' | 'placing' | 'completed' | 'failed' | 'aborted';
  retailerDomain: string;
  retailerUrl: string;
  searchTerms: string;
  maxBudgetCents: number;
  foundProductTitle: string | null;
  foundProductPrice: number | null;
  foundProductUrl: string | null;
  foundProductImage: string | null;
  matchConfidence: number | null;
  confirmationNumber: string | null;
  failureReason: 'captcha' | 'out_of_stock' | 'blocked' | 'timeout' | 'price_mismatch' | 'payment_declined' | 'address_rejected' | 'unknown' | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  steps?: AgentStep[];
}

export interface AgentStep {
  id: string;
  jobId: string;
  stepNumber: number;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  screenshotUrl: string | null;
  pageUrl: string | null;
  aiModelUsed: string | null;
  aiConfidence: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentPlaceResponse {
  job: AgentJob;
  order?: Order;
}

export interface ServiceCreditInfo {
  id: string;
  amountCents: number;
  reason: string;
  createdAt: string;
}

// S-9 Autopilot types
export interface AutopilotRule {
  id: string;
  userId: string;
  personId: string;
  isActive: boolean;
  occasionTypes: string[];
  budgetMinCents: number;
  budgetMaxCents: number;
  monthlyCapCents: number;
  leadDays: number;
  consentedAt: string;
  consentedFromIp: string;
  createdAt: string;
  updatedAt: string;
  person: { name: string };
  runs?: AutopilotRun[];
}

export interface AutopilotRun {
  id: string;
  ruleId: string;
  eventId: string;
  orderId: string | null;
  suggestionId: string | null;
  status: string;
  reason: string | null;
  confidenceScore: number | null;
  amountCents: number | null;
  createdAt: string;
  rule?: { person: { name: string } };
  event?: { name: string; occasionType: string };
}

export interface AutopilotRunsResponse {
  data: AutopilotRun[];
  meta: { page: number; limit: number; total: number };
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  meta: { page: number; limit: number; total: number };
}

export interface GiftRecordListResponse {
  data: GiftRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    year?: number;
    totalSpendCents?: number;
    averageRating?: number;
  };
}

export interface CreateGiftRecordData {
  title: string;
  description?: string;
  priceCents?: number;
  eventId?: string;
  givenAt: string;
}

export interface FeedbackResponse {
  giftRecord: GiftRecord;
  scoreChange: number;
  newScore: number;
  newLevel: string;
  promptNeverAgain: boolean;
}

export interface RecentGiftsResponse {
  gifts: Array<GiftRecord & { personName: string; eventName: string | null }>;
}

export interface CreateGiftResponse {
  giftRecord: GiftRecord;
  scoreChange: number;
  newScore: number;
  newLevel: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  upgradeUrl?: string;
  constructor(message: string, status: number, upgradeUrl?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.upgradeUrl = upgradeUrl;
  }
}

type FetchOptions = RequestInit & {
  token?: string;
};

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...rest,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      body.message || `API error ${res.status}`,
      res.status,
      body.upgrade_url,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  sendOtp: (email: string) =>
    apiFetch<{ sent: true; code?: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, code: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  me: (token: string) =>
    apiFetch<Record<string, unknown>>("/auth/me", { token }),

  // Persons
  listPersons: (token: string) =>
    apiFetch<Person[]>("/persons", { token }),

  getPerson: (token: string, id: string) =>
    apiFetch<Person>(`/persons/${id}`, { token }),

  createPerson: (token: string, data: CreatePersonData) =>
    apiFetch<Person>("/persons", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  updatePerson: (token: string, id: string, data: Partial<CreatePersonData>) =>
    apiFetch<Person>(`/persons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),

  deletePerson: (token: string, id: string) =>
    apiFetch<void>(`/persons/${id}`, { method: "DELETE", token }),

  addNeverAgain: (token: string, personId: string, description: string) =>
    apiFetch<NeverAgainItem>(`/persons/${personId}/never-again`, {
      method: "POST",
      body: JSON.stringify({ description }),
      token,
    }),

  removeNeverAgain: (token: string, personId: string, itemId: string) =>
    apiFetch<void>(`/persons/${personId}/never-again/${itemId}`, {
      method: "DELETE",
      token,
    }),

  // Events
  getUpcomingEvents: (token: string, params?: { page?: number; limit?: number; days?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.days) q.set("days", String(params.days));
    const qs = q.toString();
    return apiFetch<UpcomingEventsResponse>(`/events/upcoming${qs ? `?${qs}` : ""}`, { token });
  },

  createEvent: (token: string, personId: string, data: CreateEventData) =>
    apiFetch<BrofloEvent>(`/persons/${personId}/events`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  updateEvent: (token: string, personId: string, eventId: string, data: Partial<CreateEventData>) =>
    apiFetch<BrofloEvent>(`/persons/${personId}/events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),

  deleteEvent: (token: string, personId: string, eventId: string) =>
    apiFetch<void>(`/persons/${personId}/events/${eventId}`, {
      method: "DELETE",
      token,
    }),

  // Reminders
  getReminders: (token: string) =>
    apiFetch<Reminder[]>("/reminders", { token }),

  dismissReminder: (token: string, reminderId: string) =>
    apiFetch<Reminder>(`/reminders/${reminderId}/dismiss`, {
      method: "PATCH",
      token,
    }),

  // Suggestions (S-4)
  generateSuggestions: (
    token: string,
    data: { personId: string; eventId: string; surpriseFactor?: "safe" | "bold"; guidanceText?: string },
  ) =>
    apiFetch<SuggestionsResponse>("/ai/suggestions", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getEventSuggestions: (token: string, eventId: string, requestIndex?: number) => {
    const qs = requestIndex !== undefined ? `?requestIndex=${requestIndex}` : "";
    return apiFetch<EventSuggestionsResponse>(`/events/${eventId}/suggestions${qs}`, { token });
  },

  getSuggestionMeta: (token: string, eventId: string) =>
    apiFetch<SuggestionMetaResponse>(`/events/${eventId}/suggestions/meta`, { token }),

  selectSuggestion: (token: string, eventId: string, suggestionId: string) =>
    apiFetch<SelectSuggestionResponse>(`/events/${eventId}/select-suggestion`, {
      method: "POST",
      body: JSON.stringify({ suggestionId }),
      token,
    }),

  dismissSuggestion: (token: string, suggestionId: string, reason?: string) =>
    apiFetch<{ id: string; isDismissed: boolean; dismissalReason: string | null }>(
      `/suggestions/${suggestionId}/dismiss`,
      { method: "POST", body: JSON.stringify({ reason }), token },
    ),

  // Gift History (S-5)
  getPersonGifts: (token: string, personId: string, params?: { page?: number; limit?: number; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.year) q.set("year", String(params.year));
    const qs = q.toString();
    return apiFetch<GiftRecordListResponse>(`/persons/${personId}/gifts${qs ? `?${qs}` : ""}`, { token });
  },

  createGift: (token: string, personId: string, data: CreateGiftRecordData) =>
    apiFetch<CreateGiftResponse>(`/persons/${personId}/gifts`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  recordFeedback: (token: string, giftId: string, data: { rating: number; note?: string }) =>
    apiFetch<FeedbackResponse>(`/gifts/${giftId}/feedback`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),

  getRecentGifts: (token: string) =>
    apiFetch<RecentGiftsResponse>("/gifts/recent", { token }),

  // Billing (S-6)
  createCheckoutSession: (token: string, priceId: string) =>
    apiFetch<{ url: string }>("/billing/checkout-session", {
      method: "POST",
      body: JSON.stringify({ priceId }),
      token,
    }),

  createPortalSession: (token: string) =>
    apiFetch<{ url: string }>("/billing/portal-session", {
      method: "POST",
      token,
    }),

  getSubscription: (token: string) =>
    apiFetch<{
      subscriptionTier: string;
      stripeSubscriptionId: string | null;
      stripeCustomerId: string | null;
      hasPaymentMethod: boolean;
    }>("/billing/subscription", { token }),

  // Orders (S-7)
  previewOrder: (token: string, data: { suggestionId: string; personId: string; eventId: string; budgetMaxCents?: number }) =>
    apiFetch<OrderPreviewResponse>("/orders/preview", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  placeOrder: (token: string, data: {
    suggestionId: string;
    personId: string;
    eventId: string;
    retailerProductId: string;
    giftRecordId?: string;
    shippingName: string;
    shippingAddress1: string;
    shippingAddress2?: string;
    shippingCity: string;
    shippingState: string;
    shippingZip: string;
  }) =>
    apiFetch<Order>("/orders/place", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  cancelOrder: (token: string, orderId: string, reason?: string) =>
    apiFetch<Order>(`/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      token,
    }),

  getOrders: (token: string, params?: { page?: number; limit?: number; status?: string; sortBy?: string; sortOrder?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);
    const qs = q.toString();
    return apiFetch<OrderListResponse>(`/orders${qs ? `?${qs}` : ""}`, { token });
  },

  getOrder: (token: string, orderId: string) =>
    apiFetch<OrderDetailResponse>(`/orders/${orderId}`, { token }),

  getOrderTimeline: (token: string, orderId: string) =>
    apiFetch<OrderStatusHistoryEntry[]>(`/orders/${orderId}/timeline`, { token }),

  // Autopilot (S-9)
  listRules: (token: string) =>
    apiFetch<AutopilotRule[]>("/autopilot/rules", { token }),

  createRule: (token: string, data: {
    personId: string;
    occasionTypes: string[];
    budgetMinCents: number;
    budgetMaxCents: number;
    monthlyCapCents: number;
    leadDays?: number;
    consentGiven: boolean;
  }) =>
    apiFetch<AutopilotRule>("/autopilot/rules", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  updateRule: (token: string, ruleId: string, data: {
    occasionTypes?: string[];
    budgetMinCents?: number;
    budgetMaxCents?: number;
    monthlyCapCents?: number;
    leadDays?: number;
    isActive?: boolean;
  }) =>
    apiFetch<AutopilotRule>(`/autopilot/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),

  deleteRule: (token: string, ruleId: string) =>
    apiFetch<{ deleted: boolean }>(`/autopilot/rules/${ruleId}`, {
      method: "DELETE",
      token,
    }),

  listRuns: (token: string, params?: { ruleId?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.ruleId) q.set("ruleId", params.ruleId);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiFetch<AutopilotRunsResponse>(`/autopilot/runs${qs ? `?${qs}` : ""}`, { token });
  },

  getAutopilotSpend: (token: string) =>
    apiFetch<{ monthlySpentCents: number }>("/autopilot/spend", { token }),

  // Notifications (S-9)
  listNotifications: (token: string, params?: { page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiFetch<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ""}`, { token });
  },

  getUnreadCount: (token: string) =>
    apiFetch<{ count: number }>("/notifications/unread-count", { token }),

  markNotificationRead: (token: string, notificationId: string) =>
    apiFetch<NotificationItem>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
      token,
    }),

  markAllNotificationsRead: (token: string) =>
    apiFetch<{ success: boolean }>("/notifications/mark-all-read", {
      method: "POST",
      token,
    }),

  // Agent Orders (S-10)
  agentPreview: (token: string, data: {
    suggestionId: string;
    personId: string;
    eventId: string;
    retailerUrl?: string;
    searchTerms?: string;
  }) =>
    apiFetch<AgentJob>("/orders/agent/preview", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  agentPlace: (token: string, data: { jobId: string }) =>
    apiFetch<AgentPlaceResponse>("/orders/agent/place", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  agentGetJob: (token: string, jobId: string) =>
    apiFetch<AgentJob>(`/orders/agent/${jobId}`, { token }),

  agentGetSteps: (token: string, jobId: string) =>
    apiFetch<AgentStep[]>(`/orders/agent/${jobId}/steps`, { token }),

  agentCancel: (token: string, jobId: string) =>
    apiFetch<AgentJob>(`/orders/agent/${jobId}/cancel`, {
      method: "POST",
      token,
    }),

  markOrderManual: (token: string, orderId: string) =>
    apiFetch<{ success: boolean }>(`/orders/${orderId}/mark-manual`, {
      method: "POST",
      body: JSON.stringify({ channel: "manual_fallback" }),
      token,
    }),

  // Enrichment (S-11)
  parseWishlist: (token: string, personId: string, urls: string[]) =>
    apiFetch<{ parsed: unknown[]; persisted: WishlistItem[] }>(
      `/persons/${personId}/parse-wishlist`,
      { method: "POST", body: JSON.stringify({ urls }), token },
    ),

  getWishlistItems: (token: string, personId: string) =>
    apiFetch<WishlistItem[]>(`/persons/${personId}/wishlist-items`, { token }),

  deleteWishlistItem: (token: string, personId: string, itemId: string) =>
    apiFetch<void>(`/persons/${personId}/wishlist-items/${itemId}`, {
      method: "DELETE",
      token,
    }),

  generateTags: (token: string, personId: string) =>
    apiFetch<PersonTag[]>(`/persons/${personId}/generate-tags`, {
      method: "POST",
      token,
    }),

  getTags: (token: string, personId: string) =>
    apiFetch<PersonTag[]>(`/persons/${personId}/tags`, { token }),

  addManualTag: (token: string, personId: string, tag: string) =>
    apiFetch<PersonTag>(`/persons/${personId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tag }),
      token,
    }),

  deleteTag: (token: string, personId: string, tagId: string) =>
    apiFetch<void>(`/persons/${personId}/tags/${tagId}`, {
      method: "DELETE",
      token,
    }),

  generateInsight: (token: string, personId: string) =>
    apiFetch<{ profile_text: string; suggested_categories: string[]; data_richness: string }>(
      `/persons/${personId}/generate-insight`,
      { method: "POST", token },
    ),

  getInsight: (token: string, personId: string) =>
    apiFetch<{ profile_text: string | null; completeness_score: number }>(
      `/persons/${personId}/insight`,
      { token },
    ),

  // --- S-12: Photos ---

  uploadPhoto: async (token: string, personId: string, file: File, category?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (category) formData.append("category", category);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const res = await fetch(`${baseUrl}/persons/${personId}/photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Upload failed" }));
      throw err;
    }
    return res.json();
  },

  getPhotos: (token: string, personId: string) =>
    apiFetch<Array<{
      id: string;
      personId: string;
      category: string;
      analysisStatus: string;
      analysisJson: Record<string, unknown> | null;
      thumbUrl: string | null;
      createdAt: string;
    }>>(`/persons/${personId}/photos`, { token }),

  getPhotoUrl: (token: string, personId: string, photoId: string) =>
    apiFetch<{ url: string; thumbUrl: string | null }>(
      `/persons/${personId}/photos/${photoId}/url`,
      { token },
    ),

  deletePhoto: (token: string, personId: string, photoId: string) =>
    apiFetch<void>(
      `/persons/${personId}/photos/${photoId}`,
      { method: "DELETE", token },
    ),

  reanalyzePhoto: (token: string, personId: string, photoId: string) =>
    apiFetch<{ status: string }>(
      `/persons/${personId}/photos/${photoId}/reanalyze`,
      { method: "POST", token },
    ),
};
