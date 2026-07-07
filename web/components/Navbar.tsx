"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/watchlists", label: "Watchlists" },
  { href: "/discover", label: "Discover" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
            {/* logo mảnh */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M17 7h4v4" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">
            ASIN<span className="text-accent">Tracker</span>
          </span>
        </Link>

        <nav className="ml-4 flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-bg-hover text-ink"
                    : "text-ink-soft hover:bg-bg-soft hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto text-xs text-ink-faint">Amazon US · Keepa</div>
      </div>
    </header>
  );
}
