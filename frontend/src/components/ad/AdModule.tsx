import { cn } from "@/lib/utils";

import { AdSign } from "./AdSign";
import { partnerAds } from "./ad-data";

export type AdVariant = "sidebar" | "section";

type AdModuleProps = {
  variant?: AdVariant;
  className?: string;
};

export function AdModule({ variant = "sidebar", className }: AdModuleProps) {
  return (
    <section className={cn("p-0", className)}>
      <div
        className={cn(
          "",
          variant === "sidebar"
            ? "flex flex-col items-start gap-2"
            : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5",
        )}
      >
        {partnerAds.map((ad) => (
          <AdSign key={ad.id} ad={ad} compact />
        ))}
      </div>
    </section>
  );
}
