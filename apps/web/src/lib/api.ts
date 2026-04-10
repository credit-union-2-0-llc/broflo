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
};
