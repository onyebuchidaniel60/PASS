"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "@/motion";

/**
 * Scroll reveal for landing sections.
 *
 * Progressive enhancement: the content renders visible in the server HTML and
 * only animates once the observer reports it entering the viewport. If JS is
 * unavailable, or the observer is absent, nothing is hidden and nothing moves.
 *
 * The animation itself is CSS (`pass-reveal-in`) and collapses to no animation
 * under `prefers-reduced-motion`; this component only supplies the state.
 */
export function ScrollReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setRevealed(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0% 0% -8% 0%" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={["pass-reveal", className].filter(Boolean).join(" ")}
      data-revealed={revealed ? "true" : undefined}
    >
      {children}
    </div>
  );
}
