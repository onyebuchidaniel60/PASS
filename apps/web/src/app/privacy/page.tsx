import type { Metadata } from "next";

import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "PASS — Privacy Policy",
  description:
    "How PASS handles identity, wallet, and execution data, and what it never collects.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy."
      updated="November 14, 2026"
      intro="This policy explains what PASS collects, why it is needed, and what PASS deliberately never receives."
      sections={[
        {
          heading: "What we collect",
          body: [
            "Identity data from X: your numeric X account id, handle, display name, and avatar URL. This is how a PASS profile is created and attributed.",
            "Profile and product data you provide: display name, bio, Pass content, and the wallet address you link for execution. Execution records include the Pass version, order status, position size, and realized result.",
            "Technical data needed to operate the service, such as request logs, session identifiers, and error diagnostics. We do not log signed order payloads or key material.",
          ],
        },
        {
          heading: "What we do not collect",
          body: [
            "PASS never asks for and never stores your seed phrase or private key. Wallet signatures happen in your wallet; only the resulting signed action or approval is relayed.",
            "PASS does not collect card numbers or bank account details. Cross-chain funding is handled by NEAR Intents and the connected wallet.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "We use this data to authenticate you, render your public profile, publish and version Passes, relay authorized orders, show execution history, prevent abuse, and provide support.",
            "We do not sell personal data. We do not use your trading data to advertise third-party products.",
          ],
        },
        {
          heading: "Third parties",
          body: [
            "X provides identity. Hyperliquid provides market data and execution. Ethos provides public reputation context. NEAR Intents provides cross-chain funding. Hosting and database providers process data on our behalf.",
            "Each provider has its own privacy policy. Disconnecting X or unlinking your wallet removes the corresponding PASS connection.",
          ],
        },
        {
          heading: "Retention",
          body: [
            "We retain account, Pass, and execution records for as long as needed to operate the service and meet legal obligations. Server logs are retained for a shorter operational window.",
          ],
        },
        {
          heading: "Your choices",
          body: [
            "You can edit your profile, disconnect X, and unlink your wallet in Settings. You can contact us to ask about access, correction, or deletion of your account data.",
          ],
        },
        {
          heading: "Contact",
          body: [
            "Privacy questions can be sent through the contact page.",
          ],
        },
      ]}
    />
  );
}
