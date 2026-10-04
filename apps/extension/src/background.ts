import { PASS_API_URL, profileUrl } from "./config.js";

/**
 * PASS extension service worker.
 *
 * The service worker owns ALL API coordination (docs/EXTENSION_SPEC.md §6).
 *
 * Why it must be the service worker: a content script's fetch is subject to
 * the host page's origin and CORS policy, so it cannot reach the PASS API from
 * x.com. An extension service worker runs with the extension's own origin and
 * the manifest's host_permissions, which is what grants cross-origin access.
 * The popup also routes through here so there is exactly one code path and one
 * cache.
 *
 * The extension NEVER holds a trading key, never signs, and never executes
 * (docs/DECISIONS.md D-009, D-018.9).
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

interface ExtensionContext {
  found: boolean;
  reason?: string;
  status?: number;
  displayName?: string;
  xHandle?: string | null;
  activePassCount?: number;
  profileUrl?: string;
  passes?: { publicId: string; asset: string; direction: string; status: string }[];
}

/** Minimal PASS context for the X overlay. No prices, no PnL, no execution. */
async function resolveExtensionContext(handle: string): Promise<ExtensionContext> {
  const key = handle.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data as ExtensionContext;
  }

  try {
    const res = await fetch(
      `${PASS_API_URL}/api/v1/extension/context?handle=${encodeURIComponent(key)}`,
    );
    if (!res.ok) return { found: false, reason: "lookup_failed", status: res.status };
    const data = (await res.json()) as ExtensionContext;
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return { found: false, reason: "unreachable" };
  }
}

/**
 * Full public profile for the popup's handle-resolution override.
 * Not cached: the operator is resolving a handle interactively and expects
 * current data.
 */
async function fetchProfile(handle: string): Promise<{
  ok: boolean;
  status?: number;
  url?: string;
  profile?: unknown;
  error?: string;
}> {
  const url = `${PASS_API_URL}/api/v1/profiles/${encodeURIComponent(handle)}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return { ok: false, status: 404, url };
    if (!res.ok) return { ok: false, status: res.status, url };
    const profile = await res.json();
    return { ok: true, status: 200, url, profile };
  } catch (err) {
    return {
      ok: false,
      url,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg?.type) {
    // Overlay path: minimal context for the X profile in view.
    case "pass:resolve": {
      if (typeof msg.handle !== "string") {
        sendResponse({ found: false, reason: "bad_request" });
        return true;
      }
      resolveExtensionContext(msg.handle).then(sendResponse);
      return true;
    }

    // Popup path: full profile for an operator-supplied handle.
    case "pass:profile": {
      if (typeof msg.handle !== "string") {
        sendResponse({ ok: false, error: "bad_request" });
        return true;
      }
      fetchProfile(msg.handle).then(sendResponse);
      return true;
    }

    case "pass:config": {
      sendResponse({ apiUrl: PASS_API_URL, webUrl: profileUrl("") });
      return true;
    }

    default:
      return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  cache.clear();
});