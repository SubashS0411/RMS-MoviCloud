/**
 * Client-side API calls to admin backend for public configuration data.
 * These endpoints do not require authentication — they expose
 * read-only configuration set by the admin (coupons, loyalty config, etc.).
 */

function getAdminApiBaseUrl(): string {
  if (!import.meta.env.PROD) return '/api/admin';
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  const base = (raw && raw.trim().length > 0 ? raw.trim() : "").replace(/\/+$/, "");
  return `${base}/api/admin`;
}

async function adminGet<T>(path: string): Promise<T> {
  const url = `${getAdminApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── System Config ───────────────────────────────────────────────────────────

export interface SystemConfig {
  restaurantName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactNumber: string;
  email: string;
  website: string;
  operatingHours: string;
  currency: string;
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  logoUrl: string;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  restaurantName: "Urban Bites",
  address: "",
  city: "",
  state: "",
  pincode: "",
  contactNumber: "",
  email: "",
  website: "",
  operatingHours: "",
  currency: "INR",
  timezone: "Asia/Kolkata",
  language: "English",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12-hour",
  logoUrl: "/favicon.png",
};

export async function fetchSystemConfig(): Promise<SystemConfig> {
  try {
    const data = await adminGet<SystemConfig>("/settings/system-config");
    return { ...DEFAULT_SYSTEM_CONFIG, ...data };
  } catch {
    return DEFAULT_SYSTEM_CONFIG;
  }
}

// ─── Loyalty Config ──────────────────────────────────────────────────────────

export interface LoyaltyConfigRemote {
  loyaltyEnabled: boolean;
  pointsPerHundred: number;      // points earned per ₹100
  maxPointsPerOrder: number;
  pointsPerRupee: number;        // points needed per ₹1 discount (redemption ratio)
  minRedeemablePoints: number;
  expiryMonths: number;
  autoExpiryEnabled: boolean;
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfigRemote = {
  loyaltyEnabled: true,
  pointsPerHundred: 10,
  maxPointsPerOrder: 500,
  pointsPerRupee: 10,
  minRedeemablePoints: 100,
  expiryMonths: 12,
  autoExpiryEnabled: true,
};

export async function fetchLoyaltyConfig(): Promise<LoyaltyConfigRemote> {
  try {
    const data = await adminGet<LoyaltyConfigRemote>("/offers/loyalty-config");
    return { ...DEFAULT_LOYALTY_CONFIG, ...data };
  } catch {
    return DEFAULT_LOYALTY_CONFIG;
  }
}

// ─── Coupons ─────────────────────────────────────────────────────────────────

export interface AdminCoupon {
  id: string;
  code: string;
  description?: string;
  type: "percentage" | "flat";
  value: number;
  min_order: number;
  max_discount?: number;
  valid_from: string;
  valid_to: string;
  usage_count: number;
  usage_limit: number;
  status: "active" | "expired" | "disabled";
}

export async function fetchActiveCoupons(): Promise<AdminCoupon[]> {
  try {
    const data = await adminGet<AdminCoupon[]>("/offers/coupons?status=active");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Membership Plans ────────────────────────────────────────────────────────

export interface MembershipPlan {
  id: string;
  tier: "silver" | "gold" | "platinum";
  name: string;
  description?: string;
  monthlyPrice: number;
  pointsBoost: number;  // percentage (e.g. 25 = +25%)
  benefits: string[];
  status: "active" | "inactive";
}

export async function fetchMembershipPlans(): Promise<MembershipPlan[]> {
  try {
    const data = await adminGet<MembershipPlan[]>("/offers/memberships");
    return Array.isArray(data)
      ? data
          .filter((p) => p.status === "active")
          .map((p) => ({ ...p, id: p.id || (p as any)._id || "" }))
      : [];
  } catch {
    return [];
  }
}
