/**
 * Live-signature verification (Stage F closure, Task 2).
 *
 * Proves the client's signing and order shape are accepted by Hyperliquid
 * directly, without touching the PASS server.
 *
 * Usage:
 *   VERIFY_AGENT_KEY=0x... VERIFY_ACCOUNT_ADDRESS=0x... node scripts/verify-live-signature.mjs
 *
 * - VERIFY_AGENT_KEY: throwaway agent/API-wallet private key (0x + 64 hex).
 *   Never committed, never persisted. The key signs an L1 order action via
 *   the SAME `signExchangeRequest` the Take flow uses.
 * - VERIFY_ACCOUNT_ADDRESS: the master account address (0x + 40 hex) the
 *   agent is approved for. Used for logging only; the order action itself
 *   carries no account field (HL infers it from the agent approval).
 *
 * Flow:
 *  1. Fetch BTC mid from the live Info API (read-only, no funds needed).
 *  2. Build a minimal $10 long order via the SAME `buildOrderAction` path
 *     the client uses (imported from the web lib, not duplicated).
 *  3. Sign it via the SAME `signExchangeRequest("live", ...)` the client uses
 *     (L1 phantom-agent signing via the documented SDK flow).
 *  4. POST directly to https://api.hyperliquid.xyz/exchange with
 *     { action, nonce, signature }.
 *  5. Print the full response body verbatim.
 *
 * Exit codes:
 *  0 — HL returned a balance-related rejection (signature + schema accepted).
 *  1 — signature error, schema error, viem primary-type error, or usage error.
 *  2 — network failure reaching Hyperliquid.
 *
 * Does NOT touch the PASS server. For the relay proof see Task 4.
 */

const INFO_URL = "https://api.hyperliquid.xyz/info";
const EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

function fail1(msg) {
  console.error(msg);
  process.exit(1);
}

function fail2(msg) {
  console.error(msg);
  process.exit(2);
}

const agentKey = process.env.VERIFY_AGENT_KEY ?? "";
const accountAddress = process.env.VERIFY_ACCOUNT_ADDRESS ?? "";

if (!/^0x[0-9a-fA-F]{64}$/.test(agentKey)) {
  fail1(
    "VERIFY_AGENT_KEY must be a 0x-prefixed 32-byte hex private key. " +
      "It is operator-supplied per run and never persisted.",
  );
}
if (!/^0x[0-9a-fA-F]{40}$/.test(accountAddress)) {
  fail1("VERIFY_ACCOUNT_ADDRESS must be a 0x-prefixed 20-byte hex address.");
}

console.log(`Account (master, for approval mapping): ${accountAddress.toLowerCase()}`);

let buildOrderAction;
let privateKeyToAccount;
let signL1Action;
try {
  // The order SHAPE is imported from the web lib, never duplicated here.
  // (signer.ts itself is not imported because its bundler-style
  // extensionless relative imports do not resolve under plain Node ESM;
  // signing below is the same L1 SDK call signer.ts uses.)
  ({ buildOrderAction } = await import("../apps/web/src/lib/hyperliquid.ts"));
  ({ privateKeyToAccount } = await import("viem/accounts"));
  ({ signL1Action } = await import("@nktkas/hyperliquid/signing"));
} catch (e) {
  fail1(`Failed to import the signing path: ${e?.message ?? e}`);
}

const agentAccount = privateKeyToAccount(agentKey);
console.log(`Agent (signer): ${agentAccount.address}`);

// 1. Live mid for BTC (read-only). A fixed stale price risks a
//    price-moved rejection that proves nothing about the signature.
let mid;
try {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  if (!res.ok) fail2(`Info API HTTP ${res.status}: network failure.`);
  const mids = await res.json();
  mid = mids?.BTC;
  if (typeof mid !== "string" || Number(mid) <= 0) {
    fail1(`Info API returned no usable BTC mid: ${JSON.stringify(mids).slice(0, 200)}`);
  }
} catch (e) {
  if (e instanceof Error && /Info API HTTP/.test(e.message)) throw e;
  fail2(`Network failure reaching Hyperliquid Info API: ${e?.message ?? e}`);
}
console.log(`BTC mid (live): ${mid}`);

// 2. Minimal $10 long at the mid, floored to BTC szDecimals (5). The action
//    is built by the SAME `buildOrderAction` the client signs — imported
//    above, not reimplemented.
const sizeUsd = 10;
const px = Number(mid);
const szDecimals = 5;
const baseSize = (Math.floor((sizeUsd / px) * 10 ** szDecimals + 1e-9) / 10 ** szDecimals).toFixed(szDecimals);
if (!(Number(baseSize) > 0)) fail1("Floored base size is zero; cannot sign an empty order.");
console.log(`Order: BTC long ${baseSize} @ ${mid} (~$${sizeUsd})`);

let action;
let nonce;
try {
  action = buildOrderAction({
    assetIndex: 0,
    isBuy: true,
    price: mid,
    size: baseSize,
    reduceOnly: false,
    tif: "Gtc",
  });
  nonce = Date.now();
} catch (e) {
  fail1(`buildOrderAction failed: ${e?.message ?? e}`);
}

// 3. Sign via the SAME L1 flow the Take flow uses (signExchangeRequest live
//    mode = privateKeyToAccount + signL1Action; see apps/web/src/lib/signer.ts).
let signature;
try {
  const wallet = privateKeyToAccount(agentKey);
  signature = await signL1Action({ wallet, action, nonce });
} catch (e) {
  const msg = e?.message ?? String(e);
  console.error(`SIGNING FAILED: ${msg}`);
  process.exit(1);
}

if (!signature || typeof signature.r !== "string" || typeof signature.s !== "string") {
  fail1(`L1 signing returned no { r, s, v } signature: ${JSON.stringify(signature)}`);
}
console.log(`Nonce: ${nonce}`);
console.log(`Signature: r=${String(signature.r).slice(0, 10)}… s=${String(signature.s).slice(0, 10)}… v=${signature.v}`);

// 4. POST directly to the Exchange API. No PASS server involved.
let httpStatus;
let raw;
let parsed;
try {
  const res = await fetch(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, nonce, signature }),
  });
  httpStatus = res.status;
  raw = await res.text();
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }
} catch (e) {
  fail2(`Network failure reaching Hyperliquid Exchange API: ${e?.message ?? e}`);
}

console.log(`\n--- Hyperliquid response (HTTP ${httpStatus}, verbatim) ---`);
console.log(raw);
console.log("--- end response ---\n");

const haystack = `${httpStatus} ${raw}`;

// HL answers order errors two ways: top-level { status: "err" } (e.g. bad
// signature) and 200-ok with data.statuses[].error (e.g. margin, minimum
// value). Both are printed above; the exit code classifies them.
const balanceRe = /insufficient margin|not enough balance|insufficient balance|not enough margin|margin.*insufficient|insufficient.*margin|no .*margin|balance.*insufficient/i;
const signatureRe = /unable to recover signer|invalid signature|signature.*invalid|invalid.*signature|recover.*signer|TypedDataInvalidPrimaryType|invalid primary type|EIP-712|schema|invalid.*nonce|nonce.*invalid/i;

if (balanceRe.test(haystack)) {
  console.log("RESULT: balance-related rejection. Signature and order schema accepted by Hyperliquid.");
  process.exit(0);
}
if (signatureRe.test(haystack)) {
  console.log("RESULT: signature/schema rejection. The signing path or order shape is wrong.");
  process.exit(1);
}
// A top-level err without balance wording is a rejection but not the proof
// we need — report it as a failure, not a pass.
if (/\"status\"\s*:\s*\"err\"/.test(raw) || /\"error\"/.test(raw)) {
  if (/does not exist/i.test(raw)) {
    console.log(
      "RESULT: Hyperliquid reports the signer as unknown (never approved and/or never funded). " +
        "Approve this agent from the master account first, then re-run: a balance rejection " +
        "is the proof; an unknown-signer rejection is not.",
    );
  } else {
    console.log("RESULT: Hyperliquid rejected the order for a non-balance reason. See verbatim body above.");
  }
  process.exit(1);
}
console.log("RESULT: unexpected response shape. See verbatim body above.");
process.exit(1);
