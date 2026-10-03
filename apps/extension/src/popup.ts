/**
 * PASS extension popup. A fixed 320px surface carrying one context line and a
 * single explicit handoff action. No trading surface (D-009).
 */

const POPUP_API = "http://127.0.0.1:4000";

interface Cfg {
  apiUrl: string;
}

interface Ctx {
  found: boolean;
  reason?: string;
  displayName?: string;
  activePassCount?: number;
  profileUrl?: string;
}

const root = document.getElementById("app")!;

function render(html: () => void) {
  root.textContent = "";
  html();
}

async function main() {
  let cfg: Cfg = { apiUrl: POPUP_API };
  try {
    cfg = await chrome.runtime.sendMessage({ type: "pass:config" });
  } catch {
    /* fall back to the default */
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const match = url.match(/^https:\/\/(?:x|twitter)\.com\/([^/?#]+)/);
  const handle = match?.[1];

  if (!handle) {
    render(() => {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Open an X profile to see PASS context.";
    });
    return;
  }

  render(() => {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = `Looking up @${handle}…`;
    root.appendChild(p);
  });

  try {
    const res = await fetch(
      `${cfg.apiUrl}/api/v1/extension/context?handle=${encodeURIComponent(handle)}`,
    );
    const data = (await res.json()) as Ctx;

    render(() => {
      if (!data.found) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = `@${handle} has no PASS profile.`;
        root.appendChild(p);
        return;
      }

      const h = document.createElement("h1");
      h.textContent = data.displayName ?? handle;
      root.appendChild(h);

      const count = data.activePassCount ?? 0;
      const s = document.createElement("p");
      s.className = "muted";
      s.textContent = `${count} active Pass${count === 1 ? "" : "es"} on PASS`;
      root.appendChild(s);

      const a = document.createElement("a");
      a.className = "cta";
      a.textContent = "Open PASS";
      a.href = data.profileUrl ?? `${cfg.apiUrl.replace(/\/api.*$/, "")}/discover`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      root.appendChild(a);
    });
  } catch {
    render(() => {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "PASS API is unreachable.";
      root.appendChild(p);
    });
  }
}

void main();