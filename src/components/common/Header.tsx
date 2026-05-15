"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/members", label: "内阁成员" },
  { href: "/history", label: "历史记录" },
  { href: "/settings", label: "设置" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1a1a1a]">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 2L12 11H2L7 2Z" fill="white" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">我的智囊团</span>
        </Link>
        <nav className="flex gap-1">
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
      </div>
    </header>
  );
}
