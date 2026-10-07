import type { Metadata } from "next";

import { CreatePassClient } from "./CreatePassClient";

export const metadata: Metadata = {
  title: "PASS — Create a Pass",
  description: "Author a structured Hyperliquid trade plan and publish it.",
};

export default function Page() {
  return <CreatePassClient />;
}