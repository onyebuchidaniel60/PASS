"use client";

/**
 * Agent key management.
 *
 * D-019.1 / D-019.2:
 *  - The agent key is generated client-side with viem `generatePrivateKey`.
 *  - It NEVER goes to the API. Only its address and its EIP-712 signatures
 *    leave the client (D-018.3, D-018.9).
 *  - It is NEVER written to localStorage (docs/SECURITY_SPEC.md §4). It lives
 *    in an encrypted IndexedDB record whose encryption key is derived from a
 *    deterministic master-wallet signature. Without that derivation it falls
 *    back to in-memory-only storage for the session and warns the user.
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { bytesToHex } from "viem";

/** Session-only. Never persisted without encryption. */
let memoryKey: `0x${string}` | null = null;

const DB_NAME = "pass-agent-keystore";
const STORE = "keys";
const RECORD = "agent-key";

export interface KeystoreRecord {
  id: string;
  /** AES-GCM ciphertext of the agent private key. */
  ciphertext: string;
  iv: string;
  accountAddress: string;
  agentAddress: string;
  createdAt: string;
}

export function hasAgentKeyInMemory(): boolean {
  return memoryKey !== null;
}

export function getMemoryAgentKey(): `0x${string}` | null {
  return memoryKey;
}

/** Fresh agent/API wallet. Generated in the browser, per D-019.1. */
export function generateAgentKey(): {
  privateKey: `0x${string}`;
  agentAddress: `0x${string}`;
} {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, agentAddress: account.address };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: KeystoreRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Minimal AES-GCM helpers built on Web Crypto. */
async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`pass-agent-keystore:${secret}`),
  );
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encrypt(plaintext: string, secret: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as unknown as BufferSource,
  );
  return { ciphertext: bytesToHex(new Uint8Array(ct)), iv: bytesToHex(iv) };
}

async function decrypt(ciphertext: string, iv: string, secret: string): Promise<string> {
  const key = await deriveAesKey(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: hexToBytes(iv) as unknown as BufferSource },
    key,
    hexToBytes(ciphertext) as unknown as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Persists the agent key encrypted under a master-wallet-derived secret
 * (D-019.2). If anything fails the key stays in memory only.
 */
export async function persistAgentKey(
  privateKey: `0x${string}`,
  agentAddress: `0x${string}`,
  accountAddress: string,
  derivationSecret: string | null,
): Promise<{ persisted: boolean; warning?: string }> {
  memoryKey = privateKey;

  if (!derivationSecret) {
    return {
      persisted: false,
      warning:
        "Could not derive a storage key from your wallet, so this agent key is held in memory only. You will need to re-approve the agent on your next visit.",
    };
  }

  try {
    const { ciphertext, iv } = await encrypt(privateKey, derivationSecret);
    await idbPut(RECORD, {
      id: RECORD,
      ciphertext,
      iv,
      accountAddress,
      agentAddress,
      createdAt: new Date().toISOString(),
    });
    return { persisted: true };
  } catch {
    return {
      persisted: false,
      warning:
        "Agent key storage is unavailable in this browser, so it is held in memory only. You will need to re-approve the agent on your next visit.",
    };
  }
}

/** Decrypts the stored agent key back into memory for this session. */
export async function restoreAgentKey(derivationSecret: string | null): Promise<boolean> {
  if (memoryKey) return true;
  if (!derivationSecret) return false;
  try {
    const rec = await idbGet<KeystoreRecord>(RECORD);
    if (!rec) return false;
    const plain = await decrypt(rec.ciphertext, rec.iv, derivationSecret);
    memoryKey = plain as `0x${string}`;
    return true;
  } catch {
    await idbDelete(RECORD).catch(() => {});
    return false;
  }
}

export async function forgetAgentKey(): Promise<void> {
  memoryKey = null;
  await idbDelete(RECORD).catch(() => {});
}

export async function hasStoredAgentKey(): Promise<boolean> {
  try {
    return (await idbGet<KeystoreRecord>(RECORD)) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Signs L1 action typed data with the agent key. The key is used here and
 * nowhere else, and never leaves the browser.
 */
export async function signWithAgentKey(params: {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}): Promise<`0x${string}`> {
  if (!memoryKey) {
    throw new Error("No agent key is available in this session.");
  }
  const account = privateKeyToAccount(memoryKey);
  const { signTypedData } = await import("viem/actions");
  const sig = await signTypedData(
    {
      account,
      domain: params.domain,
      types: params.types,
      primaryType: params.primaryType,
      message: params.message,
    } as never,
    // wagmi-style client is not used; viem/actions signs with the local account.
    undefined as never,
  );
  return sig as unknown as `0x${string}`;
}

/** Used only to derive the storage secret. Never treats this as an order signature. */
export function messageForDerivation(accountAddress: string): string {
  return `PASS agent key derivation\nAccount: ${accountAddress}\nPurpose: encrypt the local PASS agent key store`;
}