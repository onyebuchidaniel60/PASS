/**
 * §14.4 the authored headline copy, as data.
 *
 * WHY THIS IS NOT IN `components/reference/headline.tsx`
 *
 * `headline.tsx` is a `"use client"` module. A Server Component that imports a
 * plain VALUE from a `"use client"` module does not receive that value: it
 * receives a client-reference proxy, so `HERO_LINES.landing` is `undefined` at
 * prerender and `HERO_LINES.landing.map(...)` throws. The failure appears only
 * in `next build`, never in a Vitest DOM test, which is why it is worth writing
 * down rather than rediscovering.
 *
 * The rule: data crosses the server/client boundary only through a module with
 * no `"use client"`. Components cross freely; constants do not.
 *
 * §14.4 requires the line breaks and the accent word to be AUTHORED, never
 * inferred, so this is structured data rather than a JSX tree: a hero that wraps
 * to five lines at 375px is a layout failure, and it is a failure at the one
 * breakpoint nobody tests.
 */

export interface HeadlineWord {
  text: string;
  /** The one ember word on this line (§14.4). */
  accent?: boolean;
}

export const HERO_LINES: Record<
  "landing" | "discover" | "take" | "howItWorks",
  readonly HeadlineWord[][]
> = {
  landing: [
    [{ text: "See" }, { text: "a" }, { text: "trade.", accent: true }],
    [{ text: "Know" }, { text: "the" }, { text: "trader." }],
    [{ text: "Take" }, { text: "the" }, { text: "trade." }],
  ],
  discover: [
    [{ text: "Live" }, { text: "plans,", accent: true }],
    [{ text: "written" }, { text: "by" }, { text: "traders." }],
  ],
  take: [
    [{ text: "You" }, { text: "author" }],
    [{ text: "your" }, { text: "own", accent: true }, { text: "size." }],
  ],
  // The accent word is "promise", not "Pass". "Pass" is the product noun and it
  // already appears verbatim in the §10.1 loop strip on the Landing page; two
  // elements reading "Pass" on one screen is ambiguity the reader has to
  // resolve, and it is avoidable for free.
  howItWorks: [
    [{ text: "A" }, { text: "plan" }, { text: "is" }],
    [{ text: "not" }, { text: "a" }, { text: "promise.", accent: true }],
  ],
};

/** Mutable copy, for the `readonly` tuples above. */
export function heroLines(
  key: keyof typeof HERO_LINES,
): HeadlineWord[][] {
  return HERO_LINES[key].map((line) => line.map((w) => ({ ...w })));
}
