import { cn } from "@/lib/utils";

/**
 * FinSight brandmark — an "insight rising" tick inside a rounded square.
 * Fills are theme-driven and overridable so the mark works on light surfaces
 * (default: indigo square) and on the indigo spine (porcelain square).
 */
export function LogoMark({
  className,
  squareClass = "fill-primary",
  tickClass = "stroke-primary-foreground",
  dotClass = "fill-accent",
}: {
  className?: string;
  squareClass?: string;
  tickClass?: string;
  dotClass?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="7" className={squareClass} />
      <polyline
        points="8.5,22 15,15.5 23,9.5"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={tickClass}
      />
      <circle cx="23" cy="9.5" r="2.6" className={dotClass} />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
  ...markProps
}: {
  className?: string;
  markClassName?: string;
  squareClass?: string;
  tickClass?: string;
  dotClass?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-inherit", className)}>
      <LogoMark className={markClassName} {...markProps} />
      <span className="wordmark text-lg tracking-tight">FinSight</span>
    </span>
  );
}
