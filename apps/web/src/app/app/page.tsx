import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import type { HomeDto } from "@pass/contracts";

import { EMPTY_HOME, LandingView } from "@/app/LandingView";

export const metadata: Metadata = {
  title: "PASS — See a trade. Know the trader. Take the trade.",
  description:
    "PASS turns Hyperliquid perp and prediction-market trade plans into shareable, executable links.",
};

/**
 * The application home at `/app`.
 *
 * This is the original PASS homepage, moved behind the marketing/application
 * split. It remains a server-rendered projection of the same public Pass and
 * execution data the Discover and profile screens read. It is force-dynamic
 * because the live activity tape is a timestamped feed, not a build artefact.
 *
 * The global topbar and footer belong to this route and every other app route;
 * the marketing page at `/` suppresses them while it is mounted.
 *
 * If the API is unreachable the page still renders every section, with honest
 * empty states rather than fabricated traders or activity.
 */
export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  let home: HomeDto = EMPTY_HOME;
  try {
    home = await apiGet<HomeDto>("/api/v1/home");
  } catch {
    home = EMPTY_HOME;
  }
  return <LandingView home={home} />;
}
