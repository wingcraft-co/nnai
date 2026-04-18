"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { trackPageView } from "@/lib/analytics/events";

type Props = {
  locale: string;
};

export function PageViewTracker({ locale }: Props) {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    trackPageView({ pathname, locale });
  }, [locale, pathname]);

  return null;
}
