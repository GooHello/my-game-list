import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import gamesData from "../../data/games.json";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 游戏数量从数据文件动态计算，避免文案过期
const gameCount = gamesData.filter(g => g !== null).length;

export const metadata: Metadata = {
  title: "Shan's Game List",
  description: `Shan's personal game collection — ${gameCount} games played and categorized.`,
  openGraph: {
    title: "Shan's Game List",
    description: `个人游戏库：${gameCount} 款游戏的游玩记录、分类与标签`,
    type: "website",
    locale: "zh_CN",
    siteName: "Shan's Game List",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
