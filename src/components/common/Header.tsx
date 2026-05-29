"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUserName, setUserName, checkApiConfig } from "@/lib/user";
import { useI18n } from "@/lib/i18n";

function useHasAiConfig(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    setHas(checkApiConfig());
    const onStorage = () => setHas(checkApiConfig());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return has;
}

export default function Header() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserNameState] = useState<string | null>(null);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const hasConfig = useHasAiConfig();

  const navItems = [
    { href: "/", label: t("header.home") },
    { href: "/members", label: t("header.members") },
    { href: "/history", label: t("header.history") },
    { href: "/settings", label: t("header.settings") },
  ];

  useEffect(() => {
    setUserNameState(getUserName());
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user-name") {
        setUserNameState(e.newValue);
      }
    };
    const handleNameChange = () => setUserNameState(getUserName());
    const handleLocaleChange = (e: CustomEvent) => {
      // Cross-tab locale sync is handled by I18nProvider
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("nickname-changed", handleNameChange);
    window.addEventListener("locale-changed", handleLocaleChange as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("nickname-changed", handleNameChange);
      window.removeEventListener("locale-changed", handleLocaleChange as EventListener);
    };
  }, []);

  const handleSaveName = () => {
    const name = editName.trim();
    if (name) {
      setUserName(name);
      setUserNameState(name);
    }
    setShowNameEdit(false);
    setEditName("");
  };

  const toggleLocale = () => {
    setLocale(locale === "zh" ? "en" : "zh");
  };

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
            <span className="text-sm font-semibold tracking-tight">{t("header.appName")}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-md px-3 py-1 text-sm font-medium transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-[#1a1a1a] text-white'
                    : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'
                }`}
              >
                {item.label}
                {item.href === "/settings" && !hasConfig && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </Link>
            ))}
            {/* Language toggle */}
            <button
              onClick={toggleLocale}
              className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600"
              title={t("common.language")}
            >
              {locale === "zh" ? "中" : "En"}
            </button>
            {userName ? (
              <button
                onClick={() => { setEditName(userName); setShowNameEdit(true); }}
                className="ml-1 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a1a] text-[10px] font-bold text-white">
                  {userName.charAt(0)}
                </span>
                {userName}
              </button>
            ) : (
              <button
                onClick={() => setShowNameEdit(true)}
                className="ml-1 rounded-md px-3 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600"
              >
                {t("header.setNickname")}
              </button>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={t("header.menu")}
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
            className="absolute right-0 top-[52px] w-48 rounded-bl-lg rounded-br-lg border bg-white/80 shadow-lg backdrop-blur-xl"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-[#1a1a1a] text-white'
                    : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'
                }`}
              >
                <span>{item.label}</span>
                {item.href === "/settings" && !hasConfig && (
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                )}
              </Link>
            ))}
            <button
              onClick={() => { setMenuOpen(false); toggleLocale(); }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900"
            >
              <span>{t("common.language")}</span>
              <span className="text-xs text-gray-400">{locale === "zh" ? "中文" : "English"}</span>
            </button>
            <button
              onClick={() => { setMenuOpen(false); setShowNameEdit(true); }}
              className="block w-full px-4 py-3 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-900"
            >
              {userName ? `${t("header.editNickname")} (${userName})` : t("header.setNickname")}
            </button>
          </div>
        </div>
      )}

      {/* Name edit modal */}
      {showNameEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNameEdit(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-xl mx-4"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              {userName ? t("header.nicknameEditTitle") : t("header.nicknameTitle")}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {userName
                ? t("header.nicknameEditSubtitle")
                : t("header.nicknameSubtitle")}
            </p>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              placeholder={t("header.nicknamePlaceholder")}
              maxLength={12}
              className="mt-4 w-full rounded-md border bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-gray-300"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
              autoFocus
            />
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSaveName}
                disabled={!editName.trim()}
                className="flex-1 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:opacity-50"
              >
                {t("common.save")}
              </button>
              <button
                onClick={() => setShowNameEdit(false)}
                className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
