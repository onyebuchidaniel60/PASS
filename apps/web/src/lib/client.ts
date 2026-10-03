"use client";

import { API_URL } from "./api";

/**
 * Browser-side API calls. Same-origin session cookies are included so the
 * server can resolve the user. Never sends key material
 * (docs/DECISIONS.md D-018.9).
 */
export async function clientApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
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
    const err = new Error(e?.error?.message ?? "Request failed") as Error & {
      code?: string;
    };
    err.code = e?.error?.code;
    throw err;
  }
  return body as T;
}

export const clientGet = <T,>(p: string) => clientApi<T>(p);
export const clientPost = <T,>(p: string, b?: unknown) =>
  clientApi<T>(p, { method: "POST", body: JSON.stringify(b ?? {}) });
export const clientPatch = <T,>(p: string, b: unknown) =>
  clientApi<T>(p, { method: "PATCH", body: JSON.stringify(b) });