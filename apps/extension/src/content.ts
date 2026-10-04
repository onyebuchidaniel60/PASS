/**
 * PASS content script.
 *
 * Runs on X, detects the profile handle from the URL, and shows a small PASS
 * card with a single explicit handoff action ("View Pass",
 * docs/UX_SPEC.md §13).
 *
 * Design notes:
 *  - The handle comes from `window.location.pathname`, never from the DOM.
 *    URL structure is authoritative and immune to X's markup churn
 *    (docs/EXTENSION_SPEC.md §8).
 *  - X is a single-page app, so navigation does not reload the page. URL
 *    changes are detected via patched history methods, `popstate`, and a
 *    polling fallback.
 *  - The card is attached as a sibling outside X's React tree so a re-render
 *    cannot wipe it, and a debounced MutationObserver re-injects it if X does
 *    remove it.
 *
 * Security rules (docs/SECURITY_SPEC.md §13, §14):
 *  - X page content is untrusted. Every rendered value is set via textContent.
 *  - innerHTML is never used.
 *  - No trading keys, no signing, no execution surface of any kind
 *    (docs/DECISIONS.md D-009).
 */

import { profileUrl } from "./config.js";

const CARD_ID = "pass-overlay-card";

/**
 * Reserved first path segments that are never a profile handle. Matched
 * exactly after lower-casing, which covers every reserved route X exposes
 * (including "i" and "intent", which must not swallow a real handle).
 */
const RESERVED = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "settings",
  "compose",
  "search",
  "i",
  "intent",
  "about",
  "privacy",
  "tos",
  "hashtag",
  "search-topic",
]);

function log(message: string, ...rest: unknown[]): void {
  // Every line is prefixed so it can be filtered in the page console.
  console.log(`[PASS] ${message}`, ...rest);
}

interface PassContext {
  found: boolean;
  reason?: string;
  displayName?: string;
  xHandle?: string | null;
  activePassCount?: number;
  profileUrl?: string;
  reputation?: { credibilityScore?: number | null } | null;
}

/** Thousands separator, locale pinned so it does not follow the X user's locale. */
function formatScore(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Extracts the profile handle from the URL.
 * `x.com/turnttfup99`, `/turnttfup99/status/123` and `/turnttfup99/with_replies`
 * all yield `turnttfup99`. Reserved routes yield null.
 *
 * `pathname` is injectable purely so the rules can be unit tested; production
 * callers pass nothing and it reads `window.location.pathname`.
 */
export function getHandleFromUrl(pathname?: string): string | null {
  const raw = pathname ?? window.location.pathname ?? "/";
  // Defensive: strip any query or hash so they can never become part of a
  // handle. `location.pathname` excludes them already.
  const path = raw.split(/[?#]/)[0] ?? "/";

  const segments = path.split("/").filter(Boolean);
  const first = segments[0];
  if (!first) return null;

  const lowered = first.toLowerCase();
  if (RESERVED.has(lowered)) return null;
  // Numeric ids are routes, not handles.
  if (/^[0-9]+$/.test(lowered)) return null;

  return lowered;
}

/**
 * Builds the card described in docs/EXTENSION_SPEC.md §3:
 *
 *   @handle
 *   PASS   Ethos 1,742
 *   1 Active Pass
 *   [View Pass]
 *
 * Every value comes from the resolved PASS context and is written with
 * textContent. innerHTML is never used, because X page content and API
 * response fields are untrusted (docs/SECURITY_SPEC.md §13).
 */
function buildCard(ctx: PassContext, handle: string): HTMLElement {
  const root = document.createElement("div");
  root.id = CARD_ID;
  root.setAttribute("data-pass-extension", "true");

  const card = document.createElement("div");
  card.className = "pass-card";

  // Subject line. The API field is xHandle; fall back to the URL handle so
  // the card always identifies whose profile this is.
  const subject = document.createElement("div");
  subject.className = "pass-handle";
  subject.textContent = `@${ctx.xHandle || handle}`;
  card.appendChild(subject);

  // Eyebrow + Ethos credibility score on one row.
  const row = document.createElement("div");
  row.className = "pass-row";

  const label = document.createElement("span");
  label.className = "pass-label";
  label.textContent = "PASS";
  row.appendChild(label);

  const score = ctx.reputation?.credibilityScore;
  if (typeof score === "number" && Number.isFinite(score)) {
    const ethos = document.createElement("span");
    ethos.className = "pass-ethos";
    ethos.textContent = `Ethos ${formatScore(score)}`;
    row.appendChild(ethos);
  }

  card.appendChild(row);

  // Active Pass count, pluralised.
  const count = ctx.activePassCount ?? 0;
  const passes = document.createElement("div");
  passes.className = "pass-passes";
  passes.textContent =
    count > 0
      ? `${formatScore(count)} Active Pass${count === 1 ? "" : "es"}`
      : "No active Passes";
  card.appendChild(passes);

  const link = document.createElement("a");
  link.className = "pass-action";
  link.textContent = "View Pass";
  link.href = ctx.profileUrl ?? profileUrl(handle);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  card.appendChild(link);

  root.appendChild(card);
  return root;
}

/** Injection anchors in priority order. No obfuscated class names. */
function findAnchor(): { node: Element | null; selector: string } {
  const primary = document.querySelector('[data-testid="primaryColumn"]');
  if (primary) return { node: primary, selector: '[data-testid="primaryColumn"]' };

  const main = document.querySelector("main");
  if (main) return { node: main, selector: "main" };

  return { node: document.body, selector: "body" };
}

function removeCard(): void {
  document.getElementById(CARD_ID)?.remove();
}

/** Injects the card for a handle. Idempotent: safe to call repeatedly. */
async function resolveAndInject(handle: string): Promise<void> {
  log(`resolving ${handle}`);

  let ctx: PassContext | undefined;
  try {
    ctx = (await chrome.runtime.sendMessage({
      type: "pass:resolve",
      handle,
    })) as PassContext | undefined;
  } catch (err) {
    log(`error: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  if (!ctx) {
    log(`error: no response from service worker for ${handle}`);
    return;
  }

  log(
    `resolved ${handle}: found=${ctx.found} activePasses=${ctx.activePassCount ?? 0}`,
  );

  if (!ctx.found) {
    removeCard();
    return;
  }

  const { node, selector } = findAnchor();
  if (!node) {
    log("error: no injection anchor found");
    return;
  }

  // Only ever one card on the page.
  const existing = document.getElementById(CARD_ID);
  if (existing) {
    // Already present: refresh its href in case the profile URL changed.
    const link = existing.querySelector("a.pass-action");
    if (link instanceof HTMLAnchorElement) {
      link.href = ctx.profileUrl ?? profileUrl(handle);
    }
    return;
  }

  const card = buildCard(ctx, handle);

  // Attach as a SIBLING, never inside X's React tree: React removes unknown
  // children on re-render. The first child of the primary column is the
  // sticky header, so inserting before it places the card at the top.
  if (selector === "body") {
    document.body.insertBefore(card, document.body.firstChild);
  } else {
    node.insertBefore(card, node.firstChild);
  }

  log(`overlay injected at ${selector}`);
}

/** Current navigation state, so we can skip redundant work. */
let currentHandle: string | null = null;
let inFlight = false;

async function evaluate(reason: string): Promise<void> {
  const handle = getHandleFromUrl();

  if (handle !== currentHandle) {
    log(`handle detected: ${handle ?? "(none)"} (${reason})`);
    currentHandle = handle;
  } else if (handle === null) {
    log(`no handle on this page (${reason})`);
  }

  if (handle === null) {
    removeCard();
    return;
  }

  if (inFlight) return;
  inFlight = true;
  try {
    await resolveAndInject(handle);
  } finally {
    inFlight = false;
  }
}

// ---------------------------------------------------------------------------
// SPA navigation detection
// ---------------------------------------------------------------------------

let lastHref = window.location.href;

/** Re-evaluates only when the URL actually changed. */
function onUrlChange(reason: string): void {
  if (window.location.href === lastHref) return;
  lastHref = window.location.href;
  log(`url changed to ${lastHref}, handle=${getHandleFromUrl() ?? "(none)"} (${reason})`);
  void evaluate(reason);
}

// X navigates with the History API, which emits no event of its own.
function patchHistory(): void {
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = function patchedPushState(
    ...args: Parameters<History["pushState"]>
  ) {
    const result = originalPush(...args);
    window.dispatchEvent(new Event("pass:urlchange"));
    return result;
  };

  history.replaceState = function patchedReplaceState(
    ...args: Parameters<History["replaceState"]>
  ) {
    const result = originalReplace(...args);
    window.dispatchEvent(new Event("pass:urlchange"));
    return result;
  };

  window.addEventListener("pass:urlchange", () => onUrlChange("history"));
}

function startWatchers(): void {
  patchHistory();

  // Back/forward.
  window.addEventListener("popstate", () => onUrlChange("popstate"));

  // Fallback polling: covers any navigation path the patches miss.
  window.setInterval(() => onUrlChange("poll"), 1000);

  // Re-inject if X's re-render removes the card. Debounced so a busy feed
  // cannot thrash the API.
  let debounce: number | undefined;
  const observer = new MutationObserver(() => {
    if (debounce !== undefined) window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      debounce = undefined;
      // Only bother if we should have a card and do not.
      if (currentHandle && !document.getElementById(CARD_ID)) {
        void evaluate("mutation");
      }
    }, 250);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------------
// Manual trigger from the popup
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "pass:rerun") {
    log("manual re-run requested from popup");
    currentHandle = null; // force a fresh resolve
    void evaluate("manual").then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

log(`content script loaded, url=${window.location.href}`);
startWatchers();
void evaluate("initial");