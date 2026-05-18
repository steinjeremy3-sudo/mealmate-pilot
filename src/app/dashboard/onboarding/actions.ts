"use server";

// Server action: a merchant creates their restaurant. RLS enforces that
// owner_user_id matches the calling user — we set it from the session,
// not from the form, so a malicious payload can't claim someone else's id.

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Whitelisted neighborhoods (BRIEF.md canon: Bishop Arts hero plus a few
// adjacent Dallas neighborhoods we plan to seed).
const ALLOWED_NEIGHBORHOODS = [
  "Bishop Arts",
  "Knox-Henderson",
  "Deep Ellum",
  "Lower Greenville",
] as const;

function errParam(message: string): string {
  return `/dashboard/onboarding?error=${encodeURIComponent(message)}`;
}

export async function createRestaurant(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const cuisine = String(formData.get("cuisine") ?? "").trim();

  if (!name) redirect(errParam("Restaurant name is required."));
  if (!address) redirect(errParam("Address is required."));
  if (!cuisine) redirect(errParam("Cuisine is required."));
  if (!ALLOWED_NEIGHBORHOODS.includes(neighborhood as (typeof ALLOWED_NEIGHBORHOODS)[number])) {
    redirect(errParam("Pick a neighborhood from the list."));
  }

  const { error } = await supabase.from("restaurants").insert({
    owner_user_id: profile.id,
    name,
    address,
    neighborhood,
    // City + MCC are pilot-wide defaults — Dallas only, sit-down restaurants
    // (MCC 5812). Expand when we have non-Bishop-Arts restaurants or
    // fast-food merchants.
    city: "Dallas",
    cuisine,
    mcc: "5812",
    status: "pending",
  });

  if (error) {
    redirect(errParam(error.message));
  }

  redirect("/dashboard");
}
