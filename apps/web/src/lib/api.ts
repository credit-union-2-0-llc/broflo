import type { Person, NeverAgainItem, CreatePersonData } from "@broflo/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
    throw new Error(body.message || `API error ${res.status}`);
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
};
