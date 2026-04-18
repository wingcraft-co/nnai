import type { Metadata } from "next";
import { Geist_Mono, Noto_Serif_KR } from "next/font/google";
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
      <body className={`${fontMono.variable} ${fontKR.variable} antialiased`}>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
