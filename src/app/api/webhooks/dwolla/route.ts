// Dwolla webhook handler.
//
// Dwolla posts JSON events to this endpoint for every transfer state
// change. We care about:
//   - customer_transfer_completed → rebate.status = 'settled'
//   - customer_transfer_failed    → rebate.status = 'failed'
//   - customer_transfer_cancelled → rebate.status = 'failed'
//
// Authentication: HMAC-SHA256 of the raw body using
// DWOLLA_WEBHOOK_SECRET (set in the Dwolla dashboard when creating
// the webhook subscription). Header: X-Request-Signature-SHA-256
// (hex). Constant-time compare so we don't leak timing.
//
// Idempotency: state advances forward only (initiated→sent→settled),
// so duplicate deliveries are no-ops via .eq('status', 'sent') on the
// WHERE clause. If Dwolla replays an event after settlement we just
// re-write the same row to the same state.

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { logAuditEvent } from "@/lib/db/audit-log";
import { dwolla } from "@/lib/dwolla";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.DWOLLA_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("DWOLLA_WEBHOOK_SECRET not configured", {
      status: 500,
    });
  }

  const signature = request.headers.get("x-request-signature-sha-256");
  if (!signature) {
    return new NextResponse("Missing X-Request-Signature-SHA-256", {
      status: 400,
    });
  }

  const rawBody = await request.text();

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  let providedBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signature, "hex");
    expectedBuf = Buffer.from(expected, "hex");
  } catch {
    return new NextResponse("Malformed signature", { status: 400 });
  }
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: DwollaEvent;
  try {
    event = JSON.parse(rawBody) as DwollaEvent;
  } catch {
    return new NextResponse("Malformed JSON", { status: 400 });
  }

  await handleEvent(event);

  return NextResponse.json({ ok: true });
}

// ====================================================================
// Event types we care about
// ====================================================================

type DwollaEvent = {
  id: string;
  topic: string;
  resourceId?: string;
  timestamp?: string;
  _links?: {
    resource?: { href?: string };
    self?: { href?: string };
  };
};

async function handleEvent(event: DwollaEvent): Promise<void> {
  const transferUrl = event._links?.resource?.href;

  switch (event.topic) {
    case "customer_transfer_completed":
      await advanceRebate(transferUrl, "settled", null);
      break;
    case "customer_transfer_failed":
    case "customer_transfer_cancelled":
      // Try to pull the underlying failure reason from Dwolla's
      // /failure-reasons endpoint for richer ops context. Best-effort.
      const reason = await tryGetFailureReason(transferUrl);
      await advanceRebate(transferUrl, "failed", reason);
      break;
    default:
      // Other events (created, etc.) — no-op. We only care about
      // terminal states.
      return;
  }
}

async function advanceRebate(
  transferUrl: string | undefined,
  next: "settled" | "failed",
  errorMessage: string | null,
): Promise<void> {
  if (!transferUrl) {
    console.warn("dwolla webhook: event missing transfer URL");
    return;
  }

  const admin = createSupabaseAdminClient();

  const updates: Record<string, unknown> = {};
  if (next === "settled") {
    updates.status = "settled";
    updates.settled_at = new Date().toISOString();
    updates.error_message = null;
  } else {
    updates.status = "failed";
    if (errorMessage) updates.error_message = errorMessage.slice(0, 500);
  }

  // We only advance from 'sent' (where Phase 4d.2d left it). If the
  // row is somehow in another state we don't overwrite — that's an
  // audit-worthy anomaly but not our caller's problem.
  const { data, error } = await admin
    .from("rebates")
    .update(updates)
    .eq("provider_transfer_id", transferUrl)
    .eq("status", "sent")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("dwolla webhook: rebate update:", error);
    return;
  }
  if (!data) {
    // Either we don't have a row for this transfer (it didn't come
    // from us), or it's already in a terminal state. Either way: ok.
    return;
  }

  await logAuditEvent({
    actor: { id: "system", role: "system" },
    action: next === "settled" ? "rebate.settled" : "rebate.failed",
    subjectType: "rebate",
    subjectId: data.id,
    metadata: {
      provider_transfer_url: transferUrl,
      error: errorMessage,
    },
  });
}

async function tryGetFailureReason(
  transferUrl: string | undefined,
): Promise<string | null> {
  if (!transferUrl) return null;
  try {
    const resp = await dwolla.get(`${transferUrl}/failure`);
    const body = resp.body as
      | { description?: string; code?: string }
      | undefined;
    if (!body) return null;
    return [body.code, body.description].filter(Boolean).join(" — ") || null;
  } catch {
    // Not every failed event has a /failure subresource — that's fine.
    return null;
  }
}
