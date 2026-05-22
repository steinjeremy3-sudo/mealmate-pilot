// Merchant KPI tile — a mono uppercase label over a large Fraunces
// value, with an optional quiet hint line.

import { Card } from "@/components/brand";

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex min-h-[120px] flex-col gap-1.5 p-5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="pt-1 font-serif text-[2.5rem] leading-none tracking-tight">
        {value}
      </span>
      {hint ? (
        <span className="mt-auto pt-2 text-xs text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </Card>
  );
}
