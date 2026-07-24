import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

/**
 * Consistent page header for the Operate surfaces: an optional icon tile,
 * a display title, a muted subtitle, and an optional right-aligned action.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-primary/10 text-primary shrink-0">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1 text-pretty">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
