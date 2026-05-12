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
    <header className="sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
        <div
          className="flex items-center justify-between rounded-xl border px-5 py-3"
          style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderColor: 'rgba(0,0,0,0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 3L11 10H3L7 3Z" fill="white" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight">我的智囊团</span>
          </Link>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
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
      </div>
    </header>
  );
}
