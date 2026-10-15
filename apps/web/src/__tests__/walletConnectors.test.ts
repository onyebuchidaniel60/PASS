import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, http } from "wagmi";
import { arbitrum } from "wagmi/chains";

import { passConnectors, wagmiConfig } from "../components/Providers";

/**
 * Wallet-connector regression (Stage F mock walk, Rabby failure).
 *
 * ConnectKit's default connector set pins the injected connector to
 * `isMetaMask` providers only, so any other browser wallet resolves no
 * provider and the modal shows its generic error screen. PASS registers
 * its own connectors: unpinned `injected()` (any EIP-1193 wallet) plus
 * Coinbase, with WalletConnect added only when its project id is set.
 */

const RABBY = { isRabby: true, request: async () => [] };

function ids(config: { connectors: readonly { id: string }[] }): string[] {
  return config.connectors.map((c) => c.id);
}

/**
 * Factory products carry no id — wagmi assigns ids when the config
 * materializes them. Build a throwaway config the same way production
 * does so the branch assertions read real ids.
 */
function materializedIds(projectId: string): string[] {
  const cfg = createConfig({
    chains: [arbitrum],
    connectors: passConnectors(projectId),
    transports: { [arbitrum.id]: http() },
  });
  return cfg.connectors.map((c) => (c as unknown as { id: string }).id);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  (window as unknown as { ethereum?: unknown }).ethereum = { ...RABBY };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete (window as unknown as { ethereum?: unknown }).ethereum;
});

describe("wagmi connectors (Providers.tsx)", () => {
  it("registers injected, MetaMask, Rabby and Coinbase tiles", () => {
    const list = ids(wagmiConfig);
    expect(list).toContain("injected");
    expect(list).toContain("metaMask");
    expect(list).toContain("rabby");
    expect(list).toContain("coinbaseWalletSDK");
    // The old default set pinned injected to isMetaMask (via ConnectKit's
    // defaults) — a MetaMask-SDK connector must not appear.
    expect(list).not.toContain("metaMaskSDK");
  });

  it("resolves a non-MetaMask provider (Rabby) through the injected connector", async () => {
    const conn = wagmiConfig.connectors.find((c) => c.id === "injected");
    expect(conn).toBeDefined();
    const getProvider = (
      conn as unknown as { getProvider: () => Promise<unknown> }
    ).getProvider;
    expect(typeof getProvider).toBe("function");
    // Pinned `injected({ target: "metaMask" })` throws ProviderNotFound
    // here because the stub exposes isRabby, not isMetaMask.
    await expect(
      getProvider.call(conn),
    ).resolves.toMatchObject({ isRabby: true });
  });

  it("omits WalletConnect when the project id env var is unset", () => {
    expect(process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID).toBeFalsy();
    expect(ids(wagmiConfig)).not.toContain("walletConnect");
    expect(materializedIds("")).toEqual([
      "injected",
      "metaMask",
      "rabby",
      "coinbaseWalletSDK",
    ]);
  });

  it("reads the WalletConnect project id from env when set", () => {
    // The live config passes NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID straight
    // through; the builder below is what it calls, so this pins the branch.
    expect(materializedIds("test-pid-123")).toEqual([
      "injected",
      "metaMask",
      "rabby",
      "coinbaseWalletSDK",
      "walletConnect",
    ]);
  });
});

describe("Take prompt provider tree", () => {
  it("mounts no nested WagmiProvider/ConnectKitProvider — it reuses the root tree", () => {
    // Static guard: the Take modal must consume the root Providers from the
    // layout. A nested provider would fork connector state and reproduce
    // this session's class of failure behind a passing unit suite.
    // (Matched on imports and JSX use, not bare words — comments name
    // ConnectKit freely.)
    const src = readFileSync(
      join(
        process.cwd(),
        "src",
        "app",
        "passes",
        "[publicId]",
        "take",
        "TakeFlowClient.tsx",
      ),
      "utf8",
    );
    for (const banned of [
      "WagmiProvider",
      "<ConnectKitProvider",
      "createConfig(",
      "getDefaultConfig(",
    ]) {
      expect(src, banned).not.toContain(banned);
    }
    // Root-tree consumption: the wagmi account hook plus ConnectKit's own
    // modal launcher. (The old custom per-connector tile list consumed the
    // root tree through `useConnect`; the ConnectKit modal replaced it, so
    // that hook name is no longer the marker — these two are.)
    expect(src).toContain("useAccount");
    expect(src).toContain("ConnectKitButton.Custom");
  });
});
