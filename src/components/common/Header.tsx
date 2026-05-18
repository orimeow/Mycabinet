"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/members", label: "成员" },
  { href: "/history", label: "历史" },
  { href: "/settings", label: "设置" },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1a1a]">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M7 2L12 11H2L7 2Z" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">我的智囊团</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-[#1a1a1a] text-white'
                    : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="菜单"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="absolute right-0 top-[52px] w-40 rounded-bl-lg rounded-br-lg border bg-white/80 shadow-lg backdrop-blur-xl"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-[#1a1a1a] text-white'
                    : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
