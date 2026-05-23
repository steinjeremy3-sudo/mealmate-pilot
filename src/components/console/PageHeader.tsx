// Console page header — the editorial topbar every desktop dashboard
// screen (merchant + admin) opens with: eyebrow, a large Fraunces
// title (nested <em> renders solid orange — no italic), an optional
// subhead, and right-aligned actions.

import { Eyebrow } from "@/components/brand";

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border px-10 pb-7 pt-9">
      <div className="min-w-0 space-y-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="pb-1 font-serif text-[2.75rem] font-medium leading-[1.05] tracking-tight [&_em]:not-italic [&_em]:font-medium [&_em]:text-orange">
          {title}
        </h1>
        {sub ? (
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {sub}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
      ) : null}
    </div>
  );
}
