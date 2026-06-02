import { apiRequest } from "@/client/api/client";
import type { Offer } from "@/client/app/data/offersData";

export async function fetchEligibleOffers(input: {
  subtotal: number;
  loyaltyPoints: number;
}): Promise<Offer[]> {
  const sp = new URLSearchParams();
  sp.set("subtotal", String(input.subtotal ?? 0));
  sp.set("loyaltyPoints", String(input.loyaltyPoints ?? 0));
  const res = await apiRequest<{ offers: Offer[] }>(`/offers/eligible?${sp.toString()}`);
  return res.offers;
}

export async function fetchOffers(): Promise<Offer[]> {
  const res = await apiRequest<{ offers: Offer[] }>("/offers");
  return res.offers;
}
