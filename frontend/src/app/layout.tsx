import type { Metadata } from "next";
import { Geist_Mono, Noto_Serif_KR, Roboto, Source_Serif_4, Inter } from "next/font/google";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import "./globals.css";

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-var",
});

const fontKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-kr-var",
});

// Google Sign-In 공식 버튼 전용 — Roboto Medium 500 (Google Identity Branding Guidelines)
const fontRoboto = Roboto({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-roboto",
});

// Country Briefing 양식 — 헤딩 serif (정부/IMF 톤)
const fontBriefingSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-briefing-serif",
});

// Country Briefing 양식 — 본문 sans (정부 보고서 본문)
const fontBriefingSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-briefing-sans",
});

export const metadata: Metadata = {
  title: "NomadNavigator AI — 나에게 맞는 도시를 찾아드립니다",
  description: "AI 기반 디지털 노마드 이민 설계 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${fontMono.variable} ${fontKR.variable} ${fontRoboto.variable} ${fontBriefingSerif.variable} ${fontBriefingSans.variable} antialiased`}
      >
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
