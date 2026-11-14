import { apiGet } from "@/lib/api";
import type { HomeDto } from "@pass/contracts";

import { EMPTY_HOME, LandingView } from "./LandingView";

/**
 * PASS Landing — design/DESIGN.md §10.1 and §14, docs/UX_SPEC.md §4.
 *
 * The public homepage is a server-rendered projection of the same public Pass
 * and execution data the Discover and profile screens read. It is force-dynamic
 * because the live activity tape is a timestamped feed, not a build artefact.
 *
 * If the API is unreachable the page still renders every section, with honest
 * empty states rather than fabricated traders or activity.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  let home: HomeDto = EMPTY_HOME;
  try {
    home = await apiGet<HomeDto>("/api/v1/home");
  } catch {
    home = EMPTY_HOME;
  }
  return <LandingView home={home} />;
}
