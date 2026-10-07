/**
 * Server-side API client.
 *
 * The web app talks to the PASS API over HTTP. Nothing provider-specific and
 * no secret ever passes through here (docs/SECURITY_SPEC.md §16).
 */

/**
 * Resolves the API base URL.
 *
 * The local fallback is DEVELOPMENT ONLY. In production a missing
 * NEXT_PUBLIC_API_URL throws instead of silently resolving to localhost: a
 * silent fallback makes every server-side call — including `generateMetadata` —
 * quietly fail and serve fallback content, which is a far harder failure to
 * diagnose than a build error. This exact class of problem cost two sessions
 * before it was caught.
 */
function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Refusing to fall back to localhost in production.",
    );
  }
  return "http://127.0.0.1:4000";
}

export const API_URL = resolveApiUrl();

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { cacheTags?: string[] } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    next: init.cacheTags ? { tags: init.cacheTags } : undefined,
    cache: init.cacheTags ? undefined : "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const e = body as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      e?.error?.code ?? "INTERNAL_ERROR",
      e?.error?.message ?? "Request failed",
      res.status,
    );
  }
  return body as T;
}

export function apiGet<T>(path: string, tags?: string[]): Promise<T> {
  return request<T>(path, tags ? { cacheTags: tags } : {});
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export function apiUrl(path: string): string {
  return `${API_URL}/api/v1${path}`;
}

/** Cookie-forwarding fetch for server components acting on behalf of a user. */
export async function apiGetAs<T>(
  path: string,
  cookieHeader: string | undefined,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const e = body as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      e?.error?.code ?? "INTERNAL_ERROR",
      e?.error?.message ?? "Request failed",
      res.status,
    );
  }
  return body as T;
}