import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

/** §10.10: every state is a value from `useAuthenticatedResource`. */
export default function SettingsPage() {
  return <SettingsClient />;
}
