// Home-feed banner — surfaces a recent confirmed visit / cash back.
// Presentational; the home page decides when to show it.

import Link from "next/link";
import { Check } from "lucide-react";

import { centsToUsd } from "@/lib/money";
import type { RebateStatus } from "@/lib/db/rebates";

export type VisitBannerData = {
  id: string;
  restaurantName: string | null;
  status: RebateStatus;
  amountCents: number;
};

export function VisitBanner({ rebate }: { rebate: VisitBannerData }) {
  const restaurant = rebate.restaurantName ?? "the restaurant";

  const line =
    rebate.status === "settled"
      ? `${centsToUsd(rebate.amountCents)} cash back from ${restaurant} just landed.`
      : rebate.status === "failed"
        ? `We hit a snag sending your cash back from ${restaurant}.`
        : `We confirmed your visit to ${restaurant}.`;

  const sub =
    rebate.status === "settled"
      ? "See the breakdown"
      : rebate.status === "failed"
        ? "Tap to sort it out"
        : "Your cash back is on the way";

  return (
    <Link href={`/app/rebates/${rebate.id}`} className="block">
      <div className="flex items-center gap-3 rounded-2xl bg-ink-deep p-4 text-bone transition-transform active:scale-[0.99]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-paprika text-white">
          <Check className="size-5" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{line}</p>
          <p className="text-xs text-bone/60">{sub}</p>
        </div>
        <span className="shrink-0 text-bone/40">→</span>
      </div>
    </Link>
  );
}
