/**
 * Focused test for the approveAgent relay path (D-019.1).
 * Verifies that the API accepts a signed approveAgent payload from the owning
 * Taker, records the agent association, refuses a non-owner, and never accepts
 * key material.
 */
const BASE = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000";
const RUN = Date.now().toString(16).padStart(12, "0").slice(-12);
const addr = (s) => `0x${s}${RUN}${RUN}`.slice(0, 42).padEnd(42, "0");

let pass = 0;
let fail = 0;
const check = (n, c, d) => {
  if (c) {
    pass += 1;
    console.log(`  PASS  ${n}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${n}${d ? ` â€” ${String(d).slice(0, 160)}` : ""}`);
  }
};

class S {
  constructor() {
    this.c = new Map();
  }
  hdr() {
    return [...this.c.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async call(m, p, b) {
    const r = await fetch(`${BASE}${p}`, {
      method: m,
      headers: {
        ...(b === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.c.size ? { Cookie: this.hdr() } : {}),
      },
      ...(b === undefined ? {} : { body: JSON.stringify(b) }),
    });
    for (const ck of r.headers.getSetCookie?.() ?? []) {
      const [pair] = ck.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.c.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const t = await r.text();
    let j = null;
    try {
      j = t ? JSON.parse(t) : null;
    } catch {
      j = { raw: t };
    }
    return { status: r.status, body: j };
  }
  get = (p) => this.call("GET", p);
  post = (p, b) => this.call("POST", p, b);
}

const AGENT = `0x${"a".repeat(40)}`;
const SIG = { r: `0x${"1".repeat(64)}`, s: `0x${"2".repeat(64)}`, v: 27 };

async function main() {
  console.log(`\napproveAgent relay test against ${BASE}\n`);

  const owner = new S();
  await owner.post("/api/v1/auth/session", {});
  const acct = await owner.post("/api/v1/me/trading-accounts", {
    accountAddress: addr("7"),
  });
  const accountId = acct.body?.id;
  check("owner links a trading account", Boolean(accountId), acct.body);

  const ok = await owner.post(`/api/v1/me/trading-accounts/${accountId}/approve-agent`, {
    agentAddress: AGENT,
    nonce: Date.now(),
    signature: SIG,
  });
  check(
    "owner can relay approveAgent",
    ok.status === 200 && ok.body?.agentAddress?.toLowerCase() === AGENT,
    JSON.stringify(ok.body),
  );

  const listed = await owner.get("/api/v1/me/trading-accounts");
  const linked = (listed.body?.accounts ?? []).find((a) => a.id === accountId);
  check(
    "agent association recorded on the account",
    linked?.agentAddress?.toLowerCase() === AGENT && linked?.agentApproved === true,
    linked,
  );

  // A non-owner must never be able to approve an agent on someone else's account.
  const other = new S();
  await other.post("/api/v1/auth/session", {});
  await other.post("/api/v1/profiles", {
    slug: `x${RUN}`.slice(0, 30),
    displayName: "Other",
  });
  const steal = await other.post(`/api/v1/me/trading-accounts/${accountId}/approve-agent`, {
    agentAddress: `0x${"b".repeat(40)}`,
    nonce: Date.now(),
    signature: SIG,
  });
  check("non-owner cannot approve an agent", steal.status === 403, steal.body);

  const anon = new S();
  const unauth = await anon.post(
    `/api/v1/me/trading-accounts/${accountId}/approve-agent`,
    { agentAddress: AGENT, nonce: Date.now(), signature: SIG },
  );
  check("unauthenticated request refused", unauth.status === 401, unauth.body);

  const badAddr = await owner.post(`/api/v1/me/trading-accounts/${accountId}/approve-agent`, {
    agentAddress: "not-an-address",
    nonce: Date.now(),
    signature: SIG,
  });
  check("malformed agentAddress refused", badAddr.status === 400, badAddr.body);

  // The endpoint must never accept key material.
  const withKey = await owner.post(`/api/v1/me/trading-accounts/${accountId}/approve-agent`, {
    agentAddress: AGENT,
    nonce: Date.now(),
    signature: SIG,
    privateKey: `0x${"9".repeat(64)}`,
  });
  check(
    "request carrying a privateKey is rejected, not stored",
    withKey.status === 400,
    withKey.body,
  );

  console.log(`\nResult: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("crashed:", e);
  process.exit(1);
});