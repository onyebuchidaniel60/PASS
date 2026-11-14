"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV } from "@/lib/nav";

/**
 * Topbar destinations with an explicit active state.
 *
 * `aria-current="page"` is the semantic carrier; the ember underline is the
 * visual reinforcement. `/` is not in NAV, and the profile destination is
 * `/settings`, so a prefix match is correct for the three nested routes.
 */
export function TopbarNav() {
  const pathname = usePathname() ?? "";
  const isActive = (href: string) =>
    href === "/discover"
      ? pathname === "/discover" || pathname.startsWith("/discover/")
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ul className="pass-nav">
      {NAV.map((item) => {
        const active = isActive(item.href);
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
