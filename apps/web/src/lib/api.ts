import type { Person, NeverAgainItem, CreatePersonData } from "@broflo/shared";

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
  status: 'pending' | 'ordered' | 'processing' | 'shipped' | 'cancelled' | 'failed';
  shippingName: string;
  shippingAddress1: string;
  shippingAddress2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
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
  signup: (data: { email: string; password: string; name?: string }) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<{ accessToken: string; refreshToken: string; user: Record<string, unknown> }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  me: (token: string) =>
    apiFetch<Record<string, unknown>>("/auth/me", { token }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>("/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiFetch<{ message: string }>("/auth/reset", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  getGoogleLoginUrl: () => `${API_URL}/auth/google`,

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

  getOrders: (token: string, params?: { page?: number; limit?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    const qs = q.toString();
    return apiFetch<OrderListResponse>(`/orders${qs ? `?${qs}` : ""}`, { token });
  },

  getOrder: (token: string, orderId: string) =>
    apiFetch<OrderDetailResponse>(`/orders/${orderId}`, { token }),
};
