"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/groundwater", label: "Groundwater Map" },
  { href: "/about", label: "About" },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="p-2 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label={`Switch to ${nextTheme} mode`}
    >
      {theme === "dark" ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-white"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zM17.9 17.39c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Neer Vazhvu</span>
              <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 ml-2">
                Chennai Water Intelligence
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-2.5 py-2.5 sm:px-3 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
