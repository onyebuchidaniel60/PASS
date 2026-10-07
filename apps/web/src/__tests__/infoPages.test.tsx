import { render, screen } from "@testing-library/react";

import ContactPage from "@/app/contact/page";
import FaqsPage from "@/app/faqs/page";
import HelpPage from "@/app/help/page";
import HowItWorksPage from "@/app/how-it-works/page";

/**
 * §14 informational pages.
 *
 * These assert the two things that make an information page trustworthy: it
 * answers the question it claims to answer, and it does not over-claim. A help
 * page that ships a contact form which discards its input teaches the reader
 * that the product does not answer, so the absence of a form is itself asserted.
 */
describe("/how-it-works", () => {
  it("renders the four steps as a 2x2 grid with a numbered badge each", () => {
    const { container } = render(<HowItWorksPage />);
    expect(container.querySelectorAll(".pass-steps")).toHaveLength(1);
    const badges = Array.from(container.querySelectorAll(".pass-step-badge")).map(
      (b) => b.textContent,
    );
    expect(badges).toEqual(["01", "02", "03", "04"]);
  });

  it("puts a data card in every visual slot and never an image", () => {
    const { container } = render(<HowItWorksPage />);
    expect(container.querySelectorAll(".pass-step-visual")).toHaveLength(4);
    expect(container.querySelectorAll(".pass-step-visual img")).toHaveLength(0);
    expect(container.querySelectorAll(".pass-step-visual .pass-metric-card").length).toBeGreaterThan(
      0,
    );
  });

  it("states the custody answer on the page, not only in the FAQs", () => {
    render(<HowItWorksPage />);
    // The single most important claim in the product. It must not be one click
    // away.
    expect(screen.getByText(/never receives a private key/i)).toBeInTheDocument();
  });

  it("frames the step set with corner brackets", () => {
    const { container } = render(<HowItWorksPage />);
    expect(container.querySelectorAll(".pass-brackets")).toHaveLength(1);
  });
});

describe("/faqs", () => {
  it("answers the six questions the product is actually asked", () => {
    render(<FaqsPage />);
    for (const q of [
      "What is a Pass?",
      "Is PASS copy trading?",
      "Who holds my funds?",
      "What is a Hyperliquid agent wallet?",
      "What happens if a Pass expires?",
      "What is Ethos?",
    ]) {
      expect(screen.getByText(q)).toBeInTheDocument();
    }
  });

  it("uses a native disclosure so it works without JavaScript", () => {
    const { container } = render(<FaqsPage />);
    const details = container.querySelectorAll("details.pass-faq");
    expect(details.length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll("details > summary")).toHaveLength(details.length);
  });

  it("says plainly that PASS is not copy trading, in the answer text", () => {
    render(<FaqsPage />);
    expect(screen.getByText(/Nothing is copied/i)).toBeInTheDocument();
  });

  it("does not promise anything the product cannot guarantee (§12.4)", () => {
    const { container } = render(<FaqsPage />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const word of ["guaranteed", "risk-free", "always", "never fails"]) {
      expect(text, word).not.toContain(word);
    }
  });
});

describe("/help", () => {
  it("offers a search field and says outright that it filters nothing", () => {
    render(<HelpPage />);
    expect(screen.getByLabelText("Search help topics")).toBeInTheDocument();
    // Shipping a search box that silently does nothing is a fake feature.
    expect(screen.getByText(/Nothing is filtered yet/i)).toBeInTheDocument();
  });

  it("describes the search field's behaviour to assistive technology", () => {
    render(<HelpPage />);
    expect(screen.getByLabelText("Search help topics")).toHaveAccessibleDescription(
      /Nothing is filtered yet/i,
    );
  });

  it("lists topics as chips and as cards, both linking somewhere real", () => {
    render(<HelpPage />);
    const chips = screen.getAllByRole("link", { name: "Agent wallet approval" });
    expect(chips.length).toBeGreaterThanOrEqual(1);
    for (const c of chips) {
      expect(c.getAttribute("href")).toMatch(/^\/(faqs|contact)/);
    }
  });

  it("shows service state as a badge with a word, never colour alone", () => {
    render(<HelpPage />);
    expect(screen.getByText("Working")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });
});

describe("/contact", () => {
  it("gives both real channels with their addresses on the page", () => {
    render(<ContactPage />);
    expect(screen.getByText("@pass.trade")).toBeInTheDocument();
    expect(screen.getByText("@pass")).toBeInTheDocument();
  });

  it("ships no contact form, and says why", () => {
    const { container } = render(<ContactPage />);
    // A form that discards its input is worse than no form: it teaches the
    // reader that PASS does not answer.
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByText(/no contact form in the MVP/i)).toBeInTheDocument();
  });

  it("states the reply window rather than implying one", () => {
    render(<ContactPage />);
    expect(screen.getByText(/within 24 hours/i)).toBeInTheDocument();
  });

  it("links to the other informational pages", () => {
    render(<ContactPage />);
    expect(screen.getByRole("link", { name: "FAQs" })).toHaveAttribute("href", "/faqs");
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
  });
});

describe("informational pages share one visual language (§14)", () => {
  const pages = [
    ["how-it-works", <HowItWorksPage key="h" />],
    ["faqs", <FaqsPage key="f" />],
    ["help", <HelpPage key="e" />],
    ["contact", <ContactPage key="c" />],
  ] as const;

  it("numbers its sections with the numbered eyebrow on every page", () => {
    for (const [name, page] of pages) {
      const { container, unmount } = render(page);
      expect(
        container.querySelectorAll(".pass-numbered-eyebrow-number").length,
        name,
      ).toBeGreaterThan(0);
      unmount();
    }
  });

  it("sets an h1 on every page, exactly one", () => {
    for (const [name, page] of pages) {
      const { container, unmount } = render(page);
      expect(container.querySelectorAll("h1").length, name).toBe(1);
      unmount();
    }
  });

  it("uses only the documented class vocabulary", () => {
    const ALLOWED = new Set(["visually-hidden"]);
    for (const [name, page] of pages) {
      const { container, unmount } = render(page);
      const classes = Array.from(container.querySelectorAll("[class]")).flatMap((el) =>
        (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
      );
      for (const c of classes) {
        expect(c.startsWith("pass-") || ALLOWED.has(c), `${name}: ${c}`).toBe(true);
      }
      unmount();
    }
  });

  it("shows no emoji and no exclamation marks (§12.2, §12.4)", () => {
    for (const [name, page] of pages) {
      const { container, unmount } = render(page);
      const text = container.textContent ?? "";
      expect(text, name).not.toMatch(/[!]/);
      expect(text, name).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      unmount();
    }
  });
});

/**
 * §14.5.4 the value slot holds a FIGURE. These assertions exist because of a
 * shipped defect: nine `/help` cards passed SENTENCES into that slot, so each
 * rendered a paragraph at `--type-data-xl-size` (2.5rem) in IBM Plex Mono, which
 * overflowed the card at every width. The operator reported it as "card titles
 * render at a size that overflows the card".
 *
 * The fix is the DataCard `prose` prop rather than a class each caller must
 * remember, so these tests assert the prop is SET wherever the value is prose.
 */
describe("prose values opt out of the figure treatment (14.5.4)", () => {
  it("marks every /help topic and state card as prose", () => {
    const { container } = render(<HelpPage />);
    const cards = container.querySelectorAll(".pass-card");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute("data-prose"), card.textContent?.slice(0, 40)).toBe("true");
    }
  });

  it("marks the /how-it-works teaser cards as prose", () => {
    const { container } = render(<HowItWorksPage />);
    const cards = container.querySelectorAll(".pass-card");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute("data-prose")).toBe("true");
    }
  });

  it("leaves the contact channel cards as figures, because they hold handles", () => {
    const { container } = render(<ContactPage />);
    // `hello` + `@pass.trade` is a split figure at the data step, not a sentence.
    expect(container.querySelectorAll("[data-prose='true']")).toHaveLength(0);
  });

  it("uses the prose class only via the prop, never a hand-written className", () => {
    const { container } = render(<HowItWorksPage />);
    // The old mechanism was className="pass-info-card" on the caller, which is
    // what nine /help cards silently forgot.
    expect(container.querySelector(".pass-info-card")).toBeNull();
    expect(container.querySelectorAll(".pass-card-prose").length).toBeGreaterThan(0);
  });
});
