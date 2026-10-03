/**
 * PASS content script.
 *
 * Runs on X, detects a profile handle, and shows a small PASS card with a
 * single explicit handoff action ("View Pass", docs/UX_SPEC.md §13).
 *
 * Security rules (docs/SECURITY_SPEC.md §13, §14):
 *  - X page content is untrusted input. Nothing from the DOM is inserted as
 *    HTML; every rendered value is set via textContent.
 *  - No innerHTML from page content.
 *  - No trading keys, no signing, no execution surface of any kind.
 */

const ROOT_ID = "pass-extension-root";
const seen = new Set<string>();

interface PassContext {
  found: boolean;
  reason?: string;
  displayName?: string;
  xHandle?: string | null;
  activePassCount?: number;
  profileUrl?: string;
}

function currentHandle(): string | null {
  const m = window.location.pathname.match(/^\/([^/]+)/);
  if (!m || !m[1]) return null;
  const handle = m[1];
  if (["home", "explore", "search", "notifications", "messages", "settings", "i"].includes(handle)) {
    return null;
  }
  return handle;
}

function buildCard(ctx: PassContext): HTMLElement {
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("data-pass-extension", "true");

  // Styling is applied from content.css via the root id. No inline HTML.
  const card = document.createElement("div");
  card.className = "pass-card";

  const label = document.createElement("span");
  label.className = "pass-label";
  label.textContent = "PASS";
  card.appendChild(label);

  const text = document.createElement("span");
  text.className = "pass-text";
  const count = ctx.activePassCount ?? 0;
  text.textContent =
    count > 0
      ? `${count} active Pass${count === 1 ? "" : "es"}`
      : (ctx.displayName ?? "Trader on PASS");
  card.appendChild(text);

  const link = document.createElement("a");
  link.className = "pass-action";
  link.textContent = "View Pass";
  link.href = ctx.profileUrl ?? "https://localhost:3000";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  card.appendChild(link);

  root.appendChild(card);
  return root;
}

function mount(handle: string) {
  if (seen.has(handle)) return;
  seen.add(handle);

  const existing = document.getElementById(ROOT_ID);
  if (existing) existing.remove();

  chrome.runtime
    .sendMessage({ type: "pass:resolve", handle })
    .then((ctx: PassContext | undefined) => {
      if (!ctx || !ctx.found) return;
      const anchor =
        document.querySelector('[data-testid="UserName"]') ??
        document.querySelector("main");
      if (!anchor) return;
      anchor.insertAdjacentElement("beforebegin", buildCard(ctx));
    })
    .catch(() => {
      /* PASS API unreachable: stay silent rather than intrude. */
    });
}

function scan() {
  const handle = currentHandle();
  if (handle) mount(handle);
}

// X is a single-page app: re-scan on navigation without leaking observers.
let lastPath = window.location.pathname;
const observer = new MutationObserver(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    seen.clear();
  }
  scan();
});

observer.observe(document.body, { childList: true, subtree: true });
scan();