"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition ${
        active ? "bg-ink text-accent-ink" : "text-muted hover:bg-line/60 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
