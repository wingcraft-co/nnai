"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

import type { PartnerAd } from "./ad-data";

type AdSignProps = {
  ad: PartnerAd;
  compact?: boolean;
};

export function AdSign({ ad, compact = false }: AdSignProps) {
  return (
    <div className="inline-flex items-end gap-0">
        <Image
          src="/grace_64.gif"
          alt=""
          width={30}
          height={30}
          unoptimized
          className="shrink-0 object-contain"
          style={{ imageRendering: "pixelated" }}
        />

      <a
        href={ad.href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`${ad.brand} partner ad link`}
        className={cn(
          "inline-flex w-[120px] items-center rounded-md border border-border bg-background px-2 py-1 text-foreground",
          "transition-colors duration-150 hover:bg-accent hover:text-accent-foreground",
          compact ? "h-[40px]" : "h-[40px]",
        )}
      >
        <p className="truncate text-[10px] leading-none font-semibold tracking-wide">{ad.brand}</p>
      </a>

        <Image
          src="/rocky_64.gif"
          alt=""
          width={30}
          height={30}
          unoptimized
          className="shrink-0 object-contain"
          style={{ imageRendering: "pixelated" }}
        />
    </div>
  );
}
