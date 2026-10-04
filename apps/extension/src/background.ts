/**
 * PASS extension service worker.
 *
 * Responsibilities are deliberately minimal: resolve PASS context for an X
 * handle and cache it briefly. The extension NEVER holds a trading key, never
 * signs, and never executes (docs/DECISIONS.md D-009, D-018.9).
 */

import { PASS_API_URL } from "./config.js";

const PASS_API = PASS_API_URL;

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

interface ExtensionContext {
  found: boolean;
  reason?: string;
  displayName?: string;
  xHandle?: string | null;
  activePassCount?: number;
  profileUrl?: string;
  passes?: { publicId: string; asset: string; direction: string; status: string }[];
}

async function resolveContext(handle: string): Promise<ExtensionContext> {
  const key = handle.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data as ExtensionContext;
  }

  try {
    const res = await fetch(
      `${PASS_API}/api/v1/extension/context?handle=${encodeURIComponent(key)}`,
    );
    if (!res.ok) return { found: false, reason: "lookup_failed" };
    const data = (await res.json()) as ExtensionContext;
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return { found: false, reason: "unreachable" };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "pass:resolve" && typeof msg.handle === "string") {
    resolveContext(msg.handle).then(sendResponse);
    return true;
  }
  if (msg?.type === "pass:config") {
    sendResponse({ apiUrl: PASS_API });
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  cache.clear();
});