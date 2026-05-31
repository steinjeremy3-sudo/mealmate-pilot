"use server";

// Merchant restaurant-photo upload. Stored in the public Supabase
// Storage bucket "restaurant-photos" (see scripts/restaurant-photos-bucket.sql).
//
// Service-role client throughout: storage writes bypass bucket RLS, and
// restaurants.UPDATE is revoked from the `authenticated` role (see
// users-restaurants-lockdown.sql), so the column write must go through
// service role too. Ownership is verified first via getRestaurantForOwner
// (RLS-scoped), then we only ever touch that restaurant's row.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { logAuditEvent } from "@/lib/db/audit-log";
import { getRestaurantForOwner } from "@/lib/db/restaurants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "restaurant-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function errParam(message: string): string {
  return `/dashboard/settings?error=${encodeURIComponent(message)}`;
}

export async function uploadRestaurantPhoto(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    redirect(errParam("Choose an image to upload."));
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    redirect(errParam("Use a JPG, PNG, or WebP image."));
  }
  if (file.size > MAX_BYTES) {
    redirect(errParam("Image must be under 5 MB."));
  }

  const admin = createSupabaseAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  // Unique filename per upload so the CDN never serves a stale photo.
  // (We don't bother deleting the prior object — orphans are cheap at
  // pilot scale.) Date.now() is fine here: this is request-time app
  // code, not a workflow script.
  const path = `${restaurant.id}/${Date.now()}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    redirect(errParam(`Upload failed: ${upErr.message}`));
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { error: dbErr } = await admin
    .from("restaurants")
    .update({ photo_url: publicUrl })
    .eq("id", restaurant.id);
  if (dbErr) {
    redirect(errParam(`Saved the image but couldn't link it: ${dbErr.message}`));
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "restaurant.photo_updated",
    subjectType: "restaurant",
    subjectId: restaurant.id,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/app");
  redirect("/dashboard/settings?photo=updated");
}

/**
 * Save the restaurant's card-statement descriptors (one per line). These
 * seed the matcher's high-precision fast-path (see
 * src/lib/matching/descriptors.ts). Unlike name/address — which change a
 * restaurant's identity and route through ops — descriptors are additive
 * and self-correcting (the matcher also learns them from confirmed
 * visits), so the merchant can edit them directly.
 *
 * Service-role write: restaurants.UPDATE is revoked from `authenticated`
 * (users-restaurants-lockdown.sql). Ownership is verified first via
 * getRestaurantForOwner, then we only touch that restaurant's row.
 */
const MAX_DESCRIPTORS = 10;
const MAX_DESCRIPTOR_LEN = 80;

export async function saveStatementDescriptors(formData: FormData): Promise<void> {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const raw = String(formData.get("descriptors") ?? "");
  // One descriptor per line; trim, collapse whitespace, drop empties,
  // dedupe case-insensitively, cap count + length.
  const seen = new Set<string>();
  const descriptors: string[] = [];
  for (const line of raw.split("\n")) {
    const v = line.trim().replace(/\s+/g, " ").slice(0, MAX_DESCRIPTOR_LEN);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    descriptors.push(v);
    if (descriptors.length >= MAX_DESCRIPTORS) break;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ statement_descriptors: descriptors })
    .eq("id", restaurant.id);
  if (error) {
    redirect(errParam(`Couldn't save statement names: ${error.message}`));
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "restaurant.descriptors_updated",
    subjectType: "restaurant",
    subjectId: restaurant.id,
    metadata: { count: descriptors.length },
  });

  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?descriptors=saved");
}

export async function removeRestaurantPhoto(): Promise<void> {
  const profile = await requireRole("merchant");
  const restaurant = await getRestaurantForOwner(profile.id);
  if (!restaurant) redirect("/dashboard/onboarding");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("restaurants")
    .update({ photo_url: null })
    .eq("id", restaurant.id);
  if (error) {
    redirect(errParam(`Couldn't remove the photo: ${error.message}`));
  }

  await logAuditEvent({
    actor: { id: profile.id, role: profile.role },
    action: "restaurant.photo_removed",
    subjectType: "restaurant",
    subjectId: restaurant.id,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/app");
  redirect("/dashboard/settings");
}
