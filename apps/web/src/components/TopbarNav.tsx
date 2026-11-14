"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavActive, NAV } from "@/lib/nav";

/**
 * Desktop topbar destinations with an explicit active state.
 *
 * `aria-current="page"` is the semantic carrier; the ember underline is the
 * visual reinforcement. Below 1024px this list is replaced by `MobileMenu`.
 */
export function TopbarNav() {
  const pathname = usePathname() ?? "";

  return (
    <ul className="pass-nav">
      {NAV.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className="pass-nav-link"
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
