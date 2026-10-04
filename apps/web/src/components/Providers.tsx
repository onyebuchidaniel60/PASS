"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { arbitrum } from "wagmi/chains";
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

// Public routing id only. Not a secret. Empty disables WalletConnect transport.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "PASS",
    walletConnectProjectId,
    chains: [hyperliquidChain],
    transports: {
      [hyperliquidChain.id]: http(),
    },
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