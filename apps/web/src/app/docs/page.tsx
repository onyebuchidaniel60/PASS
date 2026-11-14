import type { Metadata } from "next";

import { DocsClient } from "./DocsClient";

export const metadata: Metadata = {
  title: "PASS — Documentation",
  description:
    "How PASS turns Hyperliquid trade plans into shareable, executable links: trader and taker guides, HIP-4 prediction markets, the Agent API, and security.",
};

export default function DocsPage() {
  return <DocsClient />;
}
