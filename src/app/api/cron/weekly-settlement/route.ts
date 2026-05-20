// Vercel Cron entrypoint: weekly restaurant settlement.
//
// Scheduled Tuesdays 10:00 UTC (vercel.json). Same bearer-token auth
// as the plaid-sync cron — Vercel sends Authorization: Bearer
// ${CRON_SECRET}.
//
// The work lives in src/lib/settlements/run.ts so it can also be
// invoked from an admin "run now" button later.

import { NextResponse, type NextRequest } from "next/server";

import { runWeeklySettlement } from "@/lib/settlements/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new NextResponse("CRON_SECRET not configured", { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  const summary = await runWeeklySettlement();
  const durationMs = Date.now() - startedAt;

  console.log(
    `[cron/weekly-settlement] restaurants=${summary.restaurantsSettled} ` +
      `total_discount_cents=${summary.totalDiscountCents} ` +
      `invoices=${summary.invoicesCreated} errors=${summary.errors} ` +
      `duration_ms=${durationMs}`,
  );

  return NextResponse.json({
    ok: summary.errors === 0,
    ...summary,
    durationMs,
  });
}
