"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { hyperliquidChain } from "@/lib/hyperliquid";

/**
 * wagmi + viem + ConnectKit, per docs/DECISIONS.md D-019.1.
 *
 * The connector is used for master-wallet connection and EIP-712 signing of
 * the `approveAgent` action only. The master wallet never signs order actions
 * (D-019.1). No embedded wallet is configured, so PASS introduces no additional
 * custody surface (docs/SECURITY_SPEC.md §3).
 *
 * The chain is Arbitrum mainnet because Hyperliquid L1 signs with chain id
 * 42161 (0xa4b1), per the official Exchange endpoint documentation.
 */

// Public routing id only. Not a secret. Empty omits the WalletConnect
// connector (it is only registered when an id is provided); the injected
// and Coinbase paths below are unaffected. NEXT_PUBLIC_ values bake in at
// build time, so adding the id needs a redeploy to take effect.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "";

/**
 * The connectors PASS supports. Explicit rather than ConnectKit's
 * defaults: the default set pins the injected connector to `isMetaMask`
 * providers only, so any other browser wallet (Rabby, Brave, Frame…)
 * fails to resolve and ConnectKit shows its generic error screen.
 * Unpinned `injected()` accepts the default EIP-1193 provider whatever
 * wallet installed it (D-019.1 is connector-agnostic). No new dependency.
 */
export function passConnectors(projectId: string): Array<
  ReturnType<typeof injected> | ReturnType<typeof coinbaseWallet> | ReturnType<typeof walletConnect>
> {
  const list: Array<
    ReturnType<typeof injected> | ReturnType<typeof coinbaseWallet> | ReturnType<typeof walletConnect>
  > = [injected(), coinbaseWallet({ appName: "PASS", preference: "all" })];
  if (projectId) {
    // Listed only when configured. ConnectKit renders the QR itself, so no
    // display options are passed here.
    list.push(walletConnect({ projectId }));
  }
  return list;
}

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "PASS",
    walletConnectProjectId,
    chains: [hyperliquidChain],
    transports: {
      [hyperliquidChain.id]: http(),
    },
    // Explicit connectors, not ConnectKit's defaults — see passConnectors.
    connectors: passConnectors(walletConnectProjectId),
    ssr: true,
  }),
);

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { arbitrum };