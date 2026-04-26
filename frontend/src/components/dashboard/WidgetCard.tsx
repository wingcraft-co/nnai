import { X } from "lucide-react";
import type { ReactNode } from "react";

export function WidgetCard({
  title,
  subtitle,
  children,
  action,
  className = "",
  onRemove,
  locked = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  onRemove?: () => void;
  locked?: boolean;
}) {
  return (
    <section 
      className={`group relative flex flex-col rounded-3xl border border-white/40 bg-white/60 p-6 shadow-[4px_4px_20px_-2px_rgba(0,0,0,0.05)] backdrop-blur-[12px] transition-all hover:bg-white/70 hover:shadow-[6px_6px_25px_-2px_rgba(0,0,0,0.08)] ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold tracking-tight text-[#1D1D1F]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs font-medium text-muted-foreground/80">{subtitle}</p>}
        </div>
        
        <div className="flex items-center gap-2">
          {action}
          {!locked && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex size-7 items-center justify-center rounded-full bg-black/5 text-muted-foreground opacity-0 transition-all hover:bg-black/10 hover:text-foreground group-hover:opacity-100"
              aria-label="위젯 삭제"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1">
        {children}
      </div>
    </section>
  );
}
