import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/common/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mycabinet.up.railway.app"),
  title: "我的智囊团",
  description: "汇聚多元思维框架，为你的问题提供多角度深度分析",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "我的智囊团",
    description: "汇聚多元思维框架，为你的问题提供多角度深度分析",
    type: "website",
    locale: "zh_CN",
    siteName: "我的智囊团",
  },
  twitter: {
    card: "summary_large_image",
    title: "我的智囊团",
    description: "汇聚多元思维框架，为你的问题提供多角度深度分析",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <Header />
        {children}
      </body>
    </html>
  );
}
