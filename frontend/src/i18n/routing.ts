import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ko", "en"],
  defaultLocale: "ko",
  // 서비스 타겟 = 한국 디지털 노마드. 브라우저 Accept-Language로 인한 자동 /en/ redirect를
  // 막아 시스템 언어가 영어인 한국 유저(엣지케이스)가 혼재 콘텐츠를 보지 않도록 함.
  // 영어 locale은 유저가 명시적으로 URL 또는 언어 스위처로 진입한 경우에만.
  localeDetection: false,
});
