import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 text-left">
        <h1 className="text-left text-2xl font-bold leading-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-left text-sm font-normal text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
