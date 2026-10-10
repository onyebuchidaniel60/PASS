import type { Metadata } from "next";
import { Suspense } from "react";

import { CreatePassClient } from "./CreatePassClient";

export const metadata: Metadata = {
  title: "PASS — Create a Pass",
  description: "Author a structured Hyperliquid trade plan and publish it.",
};

export default function Page() {
  // The form reads ?edit={id} for edit mode, so its subtree bails out to
  // client rendering; the shell still prerenders.
  return (
    <Suspense fallback={null}>
      <CreatePassClient />
    </Suspense>
  );
}