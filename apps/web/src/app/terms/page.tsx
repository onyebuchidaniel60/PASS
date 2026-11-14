import type { Metadata } from "next";

import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "PASS — Terms of Service",
  description:
    "The terms that govern use of PASS, the non-custodial social execution layer for Hyperliquid.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service."
      updated="November 14, 2026"
      intro="These terms govern your use of PASS. By using the product, you agree to them. If you do not agree, do not use PASS."
      sections={[
        {
          heading: "What PASS is",
          body: [
            "PASS is a non-custodial social execution layer for Hyperliquid. Traders publish trade plans as Passes. Takers read those plans and choose their own position size.",
            "PASS is not a broker, exchange, investment adviser, or custodian. It does not hold your funds, private keys, or seed phrase, and it does not place an order until you authorize that order with your own wallet.",
          ],
        },
        {
          heading: "Eligibility and risk",
          body: [
            "You must be legally permitted to use Hyperliquid and the relevant prediction markets in your jurisdiction. You are responsible for complying with the laws that apply to you.",
            "Perpetual futures and prediction markets involve substantial risk, including the loss of your entire position. Historical performance, trader profiles, and Ethos reputation are context, not a promise of future results. Nothing on PASS is financial, legal, or tax advice.",
          ],
        },
        {
          heading: "Execution and custody",
          body: [
            "Orders are signed in your browser or by an agent wallet you approve. Hyperliquid executes them. PASS relays and records the result but never receives your private key.",
            "Cross-chain funding is provided through NEAR Intents. Your use of that flow is also subject to the applicable third-party terms.",
          ],
        },
        {
          heading: "Third-party services",
          body: [
            "PASS integrates with X for identity, Hyperliquid for market data and execution, Ethos for reputation context, and NEAR Intents for funding. Those services are operated by third parties and may change, fail, or become unavailable.",
          ],
        },
        {
          heading: "Acceptable use",
          body: [
            "Do not use PASS to break the law, manipulate a market, impersonate another person, distribute malware, or interfere with the service. Do not attempt to access another user's account or key material.",
          ],
        },
        {
          heading: "Availability and changes",
          body: [
            "PASS is provided as-is and may be changed, suspended, or discontinued. We may update these terms; the date above records the current version. Continued use after a change means you accept the updated terms.",
          ],
        },
        {
          heading: "Contact",
          body: [
            "Questions about these terms can be sent through the contact page.",
          ],
        },
      ]}
    />
  );
}
