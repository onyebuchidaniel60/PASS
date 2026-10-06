import type { Metadata } from "next";

import { DiscoverClient } from "./DiscoverClient";

export const metadata: Metadata = {
  title: "PASS — Explore Passes",
  description: "Published Hyperliquid trade plans you can inspect and take.",
};

export default function Page() {
  return <DiscoverClient />;
}