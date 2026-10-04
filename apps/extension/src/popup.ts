import { PASS_API_URL, profileUrl } from "./config.js";

/**
 * PASS extension popup.
 *
 * Two jobs:
 *  1. Show minimal PASS context for the X profile in the active tab.
 *  2. Provide a dev override: resolve ANY X handle by hand, so the extension
 *     can be demonstrated end-to-end without owning the viewed account.
 *
 * Security: every value coming back from the API is written with textContent
 * or set as an attribute. `innerHTML` is never used with response data,
 * because API values ultimately derive from untrusted external input
 * (docs/SECURITY_SPEC.md section 14). Nothing sensitive is sent or stored;
 * only the last queried handle is persisted.
 */

const STORAGE_KEY = "pass:lastHandle";

interface Connection {
  provider: string;
  connected: boolean;
  label: string;
}

interface Profile {
  slug: string;
  displayName: string;
  bio: string | null;
  xHandle: string | null;
  connections: Connection[];
  activePassCount: number;
  publishedPassCount: number;
  completedPassCount: number;
  reputation: {
    credibilityScore: number | null;
    reviewsCount: number | null;
    vouchesCount: number | null;
  } | null;
}

interface ProfileResponse {
  ok: boolean;
  status?: number;
  url?: string;
  profile?: unknown;
  error?: string;
}

interface NormalisedHandle {
  raw: string;
  slug: string;
}

const app = document.getElementById("app") as HTMLDivElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string | null,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clear(): void {
  while (app.firstChild) app.removeChild(app.firstChild);
}

function normalise(raw: string): NormalisedHandle {
  const trimmed = (raw ?? "").trim().replace(/^@+/, "").toLowerCase();
  return { raw: trimmed, slug: trimmed };
}

async function loadStoredHandle(): Promise<string> {
  try {
    const got = await chrome.storage.local.get(STORAGE_KEY);
    const v = got[STORAGE_KEY];
    return typeof v === "string" ? v : "";
  } catch {
    return "";
  }
}

async function storeHandle(value: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
  } catch {
    /* storage unavailable: not fatal */
  }
}

/** Renders the PASS context card for a resolved profile. */
function renderCard(p: Profile, queried: NormalisedHandle): void {
  const card = el("div", "card");

  const name = el("p", "name", p.displayName || `@${queried.slug}`);
  card.appendChild(name);

  const handle = el("p", "muted", p.xHandle ? `@${p.xHandle}` : `@${queried.slug}`);
  card.appendChild(handle);

  if (p.bio) card.appendChild(el("p", "muted", p.bio));

  const dl = el("dl", "stats");

  const addStat = (label: string, value: string) => {
    const row = el("div", "stat");
    row.appendChild(el("dt", "muted", label));
    row.appendChild(el("dd", undefined, value));
    dl.appendChild(row);
  };

  addStat("Active Passes", String(p.activePassCount ?? 0));
  addStat("Published", String(p.publishedPassCount ?? 0));
  addStat("Completed", String(p.completedPassCount ?? 0));

  // Ethos is external reputation context, shown separately from PASS
  // performance and never merged into one score (D-007, D-014).
  if (p.reputation) {
    addStat("Ethos", p.reputation.credibilityScore === null ? "—" : String(p.reputation.credibilityScore));
    addStat("Reviews", p.reputation.reviewsCount === null ? "—" : String(p.reputation.reviewsCount));
    addStat("Vouches", p.reputation.vouchesCount === null ? "—" : String(p.reputation.vouchesCount));
  }

  card.appendChild(dl);

  const link = el("a", "cta", "View on PASS");
  link.href = profileUrl(queried.slug);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  card.appendChild(link);

  clear();
  app.appendChild(card);
  app.appendChild(buildForm(queried.raw, true));
}

function renderMessage(text: string, kind: "error" | "info", queried: NormalisedHandle): void {
  clear();
  const box = el("p", kind === "error" ? "err" : "muted", text);
  app.appendChild(box);
  app.appendChild(buildForm(queried.raw, false));
}

/**
 * Resolve a handle for the authenticated Taker / Operator.
 *
 * The request is delegated to the service worker, which owns all API access
 * (docs/EXTENSION_SPEC.md §6). The popup never calls fetch() against the
 * PASS API itself, so there is exactly one code path and one cache.
 */
async function resolve(raw: string): Promise<void> {
  const queried = normalise(raw);
  if (!queried.slug) {
    renderMessage("Enter an X handle, for example turnttfup99", "info", queried);
    return;
  }

  await storeHandle(queried.slug);

  clear();
  app.appendChild(el("p", "muted", `Resolving @${queried.slug}…`));

  let result: ProfileResponse;
  try {
    result = (await chrome.runtime.sendMessage({
      type: "pass:profile",
      handle: queried.slug,
    })) as ProfileResponse;
  } catch (err) {
    renderMessage(
      `Could not reach the PASS extension service worker (${err instanceof Error ? err.message : "unknown"}). ` +
        `Try reloading the extension at chrome://extensions.`,
      "error",
      queried,
    );
    return;
  }

  if (!result) {
    renderMessage(
      "The PASS service worker did not respond. Reload the extension at chrome://extensions and try again.",
      "error",
      queried,
    );
    return;
  }

  // Network failure: the worker reports the URL it attempted so the operator
  // can see which deployment this build targets.
  if (result.ok === false && result.error) {
    renderMessage(
      `PASS API unreachable. Tried ${result.url} (${result.error})`,
      "error",
      queried,
    );
    return;
  }

  if (result.status === 404) {
    renderMessage(`No PASS profile for @${queried.slug}`, "error", queried);
    return;
  }

  if (!result.ok || !result.profile) {
    renderMessage(
      `PASS API returned ${result.status ?? "an error"} for ${result.url ?? "the request"}`,
      "error",
      queried,
    );
    return;
  }

  const body = result.profile as Profile;
  if (typeof body.slug !== "string") {
    renderMessage(`PASS API returned no profile for @${queried.slug}`, "error", queried);
    return;
  }

  renderCard(body, queried);
}

/** The dev-override form. Works independently of the content script. */
function buildForm(initial: string, collapsed: boolean): HTMLDivElement {
  const form = el("div", "form");

  const label = el("label", "muted", "Resolve any X handle");
  label.setAttribute("for", "handle");
  form.appendChild(label);

  const row = el("div", "row");

  const input = el("input", "input");
  input.id = "handle";
  input.type = "text";
  input.placeholder = "handle";
  input.value = initial;
  input.autocomplete = "off";
  input.spellcheck = false;

  const button = el("button", "btn", collapsed ? "Resolve" : "Resolve");
  button.type = "button";

  const run = () => {
    void resolve(input.value);
  };
  button.addEventListener("click", run);
  input.addEventListener("keydown", (ev) => {
    if ((ev as KeyboardEvent).key === "Enter") run();
  });

  row.appendChild(input);
  row.appendChild(button);
  form.appendChild(row);

  if (collapsed) {
    const toggle = el("button", "linkbtn", "Enter a different handle");
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      clear();
      app.appendChild(buildForm(input.value, false));
      (document.getElementById("handle") as HTMLInputElement | null)?.focus();
    });
    form.appendChild(toggle);
  }

  // Manual re-trigger: asks the content script in the active X tab to
  // re-run detection and injection immediately. Makes debugging the overlay
  // possible without navigating or reloading.
  const rerun = el("button", "linkbtn", "Show overlay on this tab");
  rerun.type = "button";
  rerun.addEventListener("click", () => void triggerOverlay(input.value));
  form.appendChild(rerun);

  return form;
}

/** Asks the active tab's content script to re-inject the overlay. */
async function triggerOverlay(handle: string): Promise<void> {
  const queried = normalise(handle || (await loadStoredHandle()));
  const note = el("p", "muted", "");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? "";
    if (!/^https:\/\/(?:x|twitter)\.com\//.test(url)) {
      note.textContent = "Open an X profile tab first.";
      note.className = "err";
      return;
    }
    if (tab?.id === undefined) {
      note.textContent = "Could not identify the active tab.";
      note.className = "err";
      return;
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: "pass:rerun",
      handle: queried.slug,
    });
    note.textContent = `Asked the tab to re-check ${queried.slug ? `@${queried.slug}` : "this profile"}. Check the X page console for [PASS] logs.`;
    note.className = "muted";
  } catch (err) {
    note.textContent = `Could not reach the content script: ${
      err instanceof Error ? err.message : "unknown"
    }. Reload the extension at chrome://extensions.`;
    note.className = "err";
  }

  // Append the status line under the form without disturbing the card.
  app.appendChild(note);
}

/** Context for the X profile in the active tab, when there is one. */
async function renderTabContext(): Promise<void> {
  let handle = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? "";
    const m = url.match(/^https:\/\/(?:x|twitter)\.com\/([^/?#]+)/);
    if (m && m[1]) handle = m[1].toLowerCase();
  } catch {
    /* tabs unavailable: fall through to the dev override */
  }

  const stored = await loadStoredHandle();
  const target = handle || stored;

  if (!target) {
    clear();
    app.appendChild(el("p", "muted", "Open an X profile, or type a handle below."));
    app.appendChild(buildForm("", false));
    return;
  }

  await resolve(target);
}

function renderHeader(): void {
  const head = el("div", "head");
  head.appendChild(el("span", "brand", "PASS"));
  const api = el("span", "muted small", PASS_API_URL.replace(/^https?:\/\//, ""));
  head.appendChild(api);
  app.appendChild(head);
}

async function main(): Promise<void> {
  app.appendChild(el("p", "muted", "Loading…"));
  renderHeader();
  await renderTabContext();
}

void main();