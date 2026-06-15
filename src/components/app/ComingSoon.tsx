import { Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      {subtitle && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{subtitle}</p>
      )}
      <p className="mt-6 inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        Em breve
      </p>
    </div>
  );
}
