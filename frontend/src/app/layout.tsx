import type { Metadata } from "next";
import { Geist_Mono, Noto_Serif_KR, Roboto, Source_Serif_4, Inter } from "next/font/google";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { readPrivacyBodyHtmlByLocale } from "@/lib/legal-docs";
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
  title: {
    default: "NomadNavigator AI — 나에게 맞는 도시를 찾아드립니다",
    template: "%s | NomadNavigator AI",
  },
  description:
    "AI가 당신의 소득, 라이프스타일, 비자 조건을 분석해 최적의 디지털 노마드 도시 TOP 3를 추천합니다. 비자, 예산, 세금까지 한 번에.",
  metadataBase: new URL("https://nnai.app"),
  alternates: {
    canonical: "/",
    languages: { ko: "/ko", en: "/en" },
  },
  openGraph: {
    type: "website",
    siteName: "NomadNavigator AI",
    title: "NomadNavigator AI — 나에게 맞는 노마드 도시를 찾아드립니다",
    description:
      "AI 기반 디지털 노마드 이민 설계 서비스. 비자, 생활비, 세금까지 맞춤 분석.",
    url: "https://nnai.app",
    locale: "ko_KR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NomadNavigator AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NomadNavigator AI",
    description:
      "AI가 추천하는 나만의 디지털 노마드 도시 TOP 3",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? undefined,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const privacyBodyHtmlByLocale = await readPrivacyBodyHtmlByLocale();

  return (
    <html lang="ko">
      <body
        className={`${fontMono.variable} ${fontKR.variable} ${fontRoboto.variable} ${fontBriefingSerif.variable} ${fontBriefingSans.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "NomadNavigator AI",
              url: "https://nnai.app",
              applicationCategory: "TravelApplication",
              operatingSystem: "Web",
              description:
                "AI 기반 디지털 노마드 이민 설계 서비스. 비자, 생활비, 세금 맞춤 분석으로 최적 도시를 추천합니다.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              creator: {
                "@type": "Organization",
                name: "Wingcraft",
                url: "https://wingcraft.co",
              },
              inLanguage: ["ko", "en"],
            }),
          }}
        />
        <PostHogProvider privacyBodyHtmlByLocale={privacyBodyHtmlByLocale}>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
