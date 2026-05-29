"use server";

// Merchant publish action — flips a draft offer to live.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { getOfferById } from "@/lib/db/offers";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { parseOfferForm } from "@/lib/offers/parse-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function publishOffer(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const offerId = String(formData.get("offer_id") ?? "");
  if (!offerId) redirect("/dashboard/offers");

  const supabase = await createSupabaseServerClient();
  // RLS lets a merchant update their own offers; if they aren't the owner
  // this is a no-op and we'll just bounce back.
  const { error } = await supabase
    .from("offers")
    .update({ status: "live" })
    .eq("id", offerId)
    .eq("status", "draft"); // only allow draft → live transition here

  if (error) {
    redirect(
      `/dashboard/offers/${offerId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "offer.published",
    subjectType: "offer",
    subjectId: offerId,
  });

  revalidatePath("/dashboard/offers");
  revalidatePath(`/dashboard/offers/${offerId}`);
  // Also invalidate the diner browse — a new live offer should show up.
  revalidatePath("/app");
  redirect(`/dashboard/offers/${offerId}`);
}

export async function updateOffer(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const offerId = String(formData.get("offer_id") ?? "");
  if (!offerId) redirect("/dashboard/offers");

  const editUrl = (msg: string) =>
    `/dashboard/offers/${offerId}/edit?error=${encodeURIComponent(msg)}`;

  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  // Verify ownership + that the offer is still editable (not archived).
  const offer = await getOfferById(offerId);
  if (!offer || offer.restaurant_id !== restaurant.id) {
    redirect("/dashboard/offers");
  }
  const expired =
    offer.ends_at != null && new Date(offer.ends_at).getTime() < Date.now();
  if (offer.status === "ended" || expired) {
    redirect(
      `/dashboard/offers/${offerId}?error=${encodeURIComponent(
        "Ended offers can't be edited.",
      )}`,
    );
  }

  const parsed = parseOfferForm(formData);
  if (!parsed.ok) redirect(editUrl(parsed.error));
  const v = parsed.value;

  // ends_at: recurring → open-ended. Non-recurring → keep the existing
  // future end date if there is one, otherwise default to a week out.
  let endsAt: string | null;
  if (v.recurring) {
    endsAt = null;
  } else if (offer.ends_at && new Date(offer.ends_at).getTime() > Date.now()) {
    endsAt = offer.ends_at;
  } else {
    endsAt = new Date(Date.now() + WEEK_MS).toISOString();
  }

  const title = `${v.discountPct}% off`;
  const description = `${v.discountPct}% off your check at ${restaurant.name}.`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("offers")
    .update({
      title,
      description,
      discount_pct: v.discountPct,
      min_check_cents: v.minCheckCents,
      valid_days: v.validDays,
      valid_start_time: v.validStartTime,
      valid_end_time: v.validEndTime,
      max_claims_total: v.maxRedemptions,
      ends_at: endsAt,
    })
    .eq("id", offerId)
    .in("status", ["draft", "scheduled", "live"]) // never touch ended
    .select("id");

  if (error) redirect(editUrl(error.message));
  if (!data || data.length === 0) {
    redirect(
      `/dashboard/offers/${offerId}?error=${encodeURIComponent(
        "Couldn't save changes. You may not own this offer, or it's already ended.",
      )}`,
    );
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "offer.updated",
    subjectType: "offer",
    subjectId: offerId,
  });

  revalidatePath("/dashboard/offers");
  revalidatePath(`/dashboard/offers/${offerId}`);
  revalidatePath("/app");
  redirect(`/dashboard/offers/${offerId}`);
}

export async function endOffer(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const offerId = String(formData.get("offer_id") ?? "");
  if (!offerId) redirect("/dashboard/offers");

  const supabase = await createSupabaseServerClient();
  // Active claims keep their hour to redeem; only the offer flips to
  // ended (stops being claimable, stops appearing on /app).
  // .select() forces the UPDATE to return the affected rows so we can
  // detect an RLS-filtered no-op (e.g. merchant doesn't own this offer).
  const { data, error } = await supabase
    .from("offers")
    .update({
      status: "ended",
      ends_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .in("status", ["draft", "scheduled", "live"])
    .select("id");

  if (error) {
    redirect(
      `/dashboard/offers/${offerId}?error=${encodeURIComponent(error.message)}`,
    );
  }
  if (!data || data.length === 0) {
    // Either RLS blocked it (not your offer) or the offer wasn't in a
    // status that allows ending. Tell the user.
    redirect(
      `/dashboard/offers/${offerId}?error=${encodeURIComponent(
        "Couldn't end this offer. You may not own it, or it may already be ended.",
      )}`,
    );
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "offer.ended",
    subjectType: "offer",
    subjectId: offerId,
  });

  revalidatePath("/dashboard/offers");
  revalidatePath(`/dashboard/offers/${offerId}`);
  revalidatePath("/app");
  redirect(`/dashboard/offers/${offerId}`);
}
