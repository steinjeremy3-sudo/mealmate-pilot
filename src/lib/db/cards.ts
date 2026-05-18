// Card queries. RLS-respecting.

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CardStatus = "active" | "expired" | "removed";

export type Card = {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  status: CardStatus;
  created_at: string;
  updated_at: string;
};

/** Cards for the signed-in user. */
export async function getMyCards(): Promise<Card[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMyCards:", error);
    return [];
  }
  return (data ?? []) as Card[];
}

/** Default card for the signed-in user, if any. */
export async function getMyDefaultCard(): Promise<Card | null> {
  const cards = await getMyCards();
  return cards.find((c) => c.is_default) ?? cards[0] ?? null;
}
