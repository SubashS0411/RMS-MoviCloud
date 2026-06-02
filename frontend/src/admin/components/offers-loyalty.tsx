import { useState, useEffect } from "react";
import { offersApi } from "@/admin/utils/api";
import { LoadingOffers } from '@/admin/components/ui/loading-spinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/admin/components/ui/card";
import { Button } from "@/admin/components/ui/button";
import { Input } from "@/admin/components/ui/input";
import { Label } from "@/admin/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/admin/components/ui/tabs";
import { Badge } from "@/admin/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/admin/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/admin/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/admin/components/ui/select";
import { Separator } from "@/admin/components/ui/separator";
import { Switch } from "@/admin/components/ui/switch";
import { Slider } from "@/admin/components/ui/slider";
import {
  Tag,
  Percent,
  IndianRupee,
  Gift,
  Star,
  Trophy,
  Crown,
  Sparkles,
  Plus,
  Edit,
  Trash2,
  Copy,
  Calendar,
  Check,
  X,
  TrendingUp,
  Users,
  ShoppingBag,
  Search,
  Ban,
  CheckCircle,
  Power,
  PowerOff,
  CreditCard,
  Zap,
  TrendingDown,
  RotateCcw,
  AlertCircle,
  Award,
  Target,
  Clock,
  Settings,
  Save,
  Info,
  MessageSquare,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/admin/components/ui/utils";

interface Coupon {
  id: string;
  code: string;
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

interface MembershipPlan {
  id: string;
  name: string;
  tier: MembershipTier;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  monthlyPrice: number;
  billingCycle: string;
  status: "active" | "inactive";
  benefits: PlanBenefits;
}

type MembershipTier = "silver" | "gold" | "platinum";

interface PlanBenefits {
  loyaltyBonus: number;
  exclusiveCoupons: boolean;
  freeDelivery: boolean;
  prioritySupport: boolean;
}

const MEMBERSHIP_TIER_ORDER: MembershipTier[] = ["silver", "gold", "platinum"];

const MEMBERSHIP_TIER_DISPLAY: Record<MembershipTier, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const MEMBERSHIP_TIER_BENEFITS: Record<MembershipTier, PlanBenefits> = {
  silver: {
    loyaltyBonus: 20,
    exclusiveCoupons: true,
    freeDelivery: false,
    prioritySupport: false,
  },
  gold: {
    loyaltyBonus: 50,
    exclusiveCoupons: true,
    freeDelivery: true,
    prioritySupport: false,
  },
  platinum: {
    loyaltyBonus: 80,
    exclusiveCoupons: true,
    freeDelivery: true,
    prioritySupport: true,
  },
};

const normalizeTier = (value: unknown): MembershipTier => {
  const tier = String(value || "").trim().toLowerCase();
  if (tier === "gold" || tier === "platinum") {
    return tier;
  }
  return "silver";
};

const getTierDisplayName = (tier: MembershipTier): string => MEMBERSHIP_TIER_DISPLAY[tier];

const getTierBenefits = (tier: MembershipTier): PlanBenefits => ({
  ...MEMBERSHIP_TIER_BENEFITS[tier],
});

interface LoyaltyConfig {
  pointsPerHundred: number;
  maxPointsPerOrder: number;
  loyaltyEnabled: boolean;
  pointsPerRupee: number; // Points required per ₹1 discount
  minRedeemablePoints: number;
  expiryMonths: number;
  autoExpiryEnabled: boolean;
}

interface Feedback {
  id: string;
  customerName: string;
  customerId: string;
  orderId: string;
  rating: number; // 1-5 stars
  comment: string;
  pointsAwarded: number;
  submittedAt: string;
}

export function OffersLoyalty() {
  const [activeTab, setActiveTab] = useState("coupons");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] =
    useState(false);
  const [editingCoupon, setEditingCoupon] =
    useState<Coupon | null>(null);
  const [editingPlan, setEditingPlan] =
    useState<MembershipPlan | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  // Form states for Create/Edit Coupon
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage" as "percentage" | "flat",
    value: "",
    min_order: "",
    max_discount: "",
    valid_from: "",
    valid_to: "",
    usage_limit: "",
  });

  // Membership Plan Form Data
  const [planFormData, setPlanFormData] = useState({
    name: getTierDisplayName("silver"),
    tier: "silver" as MembershipTier,
    monthlyPrice: "",
    loyaltyBonus: MEMBERSHIP_TIER_BENEFITS.silver.loyaltyBonus.toString(),
    exclusiveCoupons: MEMBERSHIP_TIER_BENEFITS.silver.exclusiveCoupons,
    freeDelivery: MEMBERSHIP_TIER_BENEFITS.silver.freeDelivery,
    prioritySupport: MEMBERSHIP_TIER_BENEFITS.silver.prioritySupport,
  });

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Membership Plans State
  const [membershipPlans, setMembershipPlans] = useState<
    MembershipPlan[]
  >([]);

  // Loyalty Configuration State
  const [loyaltyConfig, setLoyaltyConfig] =
    useState<LoyaltyConfig>({
      pointsPerHundred: 10,
      maxPointsPerOrder: 500,
      loyaltyEnabled: true,
      pointsPerRupee: 10,
      minRedeemablePoints: 100,
      expiryMonths: 12,
      autoExpiryEnabled: true,
    });

  // Feedback State
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  // Feedback Form State
  const [feedbackFormData, setFeedbackFormData] = useState({
    customerName: "",
    customerId: "",
    orderId: "",
    rating: 5,
    comment: "",
  });

  // Check if coupon is expired based on date
  const isCouponExpired = (validTo: string): boolean => {
    return new Date(validTo) < new Date();
  };

  // Fetch data from API
  const fetchCoupons = async () => {
    try {
      const data = await offersApi.listCoupons();
      const mapped = data.map((c: any) => ({
        id: c._id || c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        min_order: c.min_order,
        max_discount: c.max_discount,
        valid_from: c.valid_from,
        valid_to: c.valid_to,
        usage_count: c.usage_count || 0,
        usage_limit: c.usage_limit || 999,
        status: c.status || "active",
      }));
      setCoupons(mapped);
    } catch (err) {
      console.error("Failed to fetch coupons:", err);
    }
  };

  const fetchMemberships = async () => {
    try {
      const data = await offersApi.listMemberships();
      const mapped: MembershipPlan[] = data.map((m: any) => {
        const tier = normalizeTier(m.tier);
        return {
          id: m._id || m.id,
          name: getTierDisplayName(tier),
          tier,
          icon: tier === "platinum" ? <Trophy className="h-6 w-6" /> : tier === "gold" ? <Crown className="h-6 w-6" /> : <Star className="h-6 w-6" />,
          color: tier === "platinum" ? "text-purple-600" : tier === "gold" ? "text-yellow-600" : "text-gray-600",
          bgColor: tier === "platinum" ? "bg-purple-50" : tier === "gold" ? "bg-yellow-50" : "bg-gray-50",
          borderColor: tier === "platinum" ? "border-purple-300" : tier === "gold" ? "border-yellow-300" : "border-gray-300",
          monthlyPrice: Number(m.monthlyPrice) || 0,
          billingCycle: "/monthly",
          status: m.status === "inactive" ? "inactive" : "active",
          benefits: getTierBenefits(tier),
        };
      });

      const dedupedByTier = new Map<MembershipTier, MembershipPlan>();
      mapped.forEach((plan) => {
        const current = dedupedByTier.get(plan.tier);
        if (!current) {
          dedupedByTier.set(plan.tier, plan);
          return;
        }
        if (plan.status === "active" && current.status !== "active") {
          dedupedByTier.set(plan.tier, plan);
        }
      });

      const ordered = MEMBERSHIP_TIER_ORDER
        .map((tier) => dedupedByTier.get(tier))
        .filter((plan): plan is MembershipPlan => Boolean(plan));

      setMembershipPlans(ordered);
    } catch (err) {
      console.error("Failed to fetch memberships:", err);
    }
  };

  const fetchLoyaltyConfig = async () => {
    try {
      const data = await offersApi.getLoyaltyConfig();
      if (data) {
        setLoyaltyConfig({
          pointsPerHundred: data.pointsPerHundred || 10,
          maxPointsPerOrder: data.maxPointsPerOrder || 500,
          loyaltyEnabled: data.loyaltyEnabled ?? true,
          pointsPerRupee: data.pointsPerRupee || 10,
          minRedeemablePoints: data.minRedeemablePoints || 100,
          expiryMonths: data.expiryMonths || 12,
          autoExpiryEnabled: data.autoExpiryEnabled ?? true,
        });
      }
    } catch (err) {
      console.error("Failed to fetch loyalty config:", err);
    }
  };

  const fetchFeedback = async () => {
    try {
      const data = await offersApi.listFeedback();
      const getNumericRating = (feedback: any): number => {
        const directRating = Number(feedback?.rating);
        if (Number.isFinite(directRating) && directRating > 0) {
          return Math.min(5, Math.max(1, Math.round(directRating)));
        }

        const foodRatings = feedback?.foodRatings;
        if (foodRatings && typeof foodRatings === "object") {
          const values = Object.values(foodRatings)
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0);

          if (values.length > 0) {
            const avg =
              values.reduce((sum, value) => sum + value, 0) /
              values.length;
            return Math.min(5, Math.max(1, Math.round(avg)));
          }
        }

        return 0;
      };

      const mapped = data.map((f: any) => ({
        id: f._id || f.id,
        customerName:
          f.customerName ||
          f.customer_name ||
          f.userName ||
          (typeof f.userId === "string"
            ? f.userId.split("@")[0]
            : "Guest"),
        customerId:
          f.customerId ||
          f.customer_id ||
          f.userId ||
          f.user_id ||
          "N/A",
        orderId: f.orderId || f.order_id || "-",
        rating: getNumericRating(f),
        comment: f.comment || f.review || "-",
        pointsAwarded: f.pointsAwarded || 0,
        submittedAt:
          f.submittedAt ||
          f.createdAt ||
          f.created_at ||
          "",
      }));
      setFeedbacks(mapped);
    } catch (err) {
      console.error("Failed to fetch feedback:", err);
    }
  };

  // Auto-update expired coupons
  const updateExpiredStatus = () => {
    setCoupons((prevCoupons) =>
      prevCoupons.map((coupon) => {
        if (
          isCouponExpired(coupon.valid_to) &&
          coupon.status === "active"
        ) {
          return { ...coupon, status: "expired" as const };
        }
        return coupon;
      }),
    );
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCoupons(), fetchMemberships(), fetchLoyaltyConfig(), fetchFeedback()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Periodically update expired coupons
  useEffect(() => {
    updateExpiredStatus();
    const interval = setInterval(updateExpiredStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [coupons.length]);

  const resetForm = () => {
    setFormData({
      code: "",
      type: "percentage",
      value: "",
      min_order: "",
      max_discount: "",
      valid_from: "",
      valid_to: "",
      usage_limit: "",
    });
    setEditingCoupon(null);
  };

  const resetPlanForm = () => {
    const defaultBenefits = getTierBenefits("silver");
    setPlanFormData({
      name: getTierDisplayName("silver"),
      tier: "silver",
      monthlyPrice: "",
      loyaltyBonus: defaultBenefits.loyaltyBonus.toString(),
      exclusiveCoupons: defaultBenefits.exclusiveCoupons,
      freeDelivery: defaultBenefits.freeDelivery,
      prioritySupport: defaultBenefits.prioritySupport,
    });
    setEditingPlan(null);
  };

  const handleCreateCoupon = async () => {
    if (
      !formData.code ||
      !formData.value ||
      !formData.min_order ||
      !formData.valid_from ||
      !formData.valid_to
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const payload = {
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: Number(formData.value),
        min_order: Number(formData.min_order),
        max_discount: formData.max_discount ? Number(formData.max_discount) : undefined,
        valid_from: formData.valid_from,
        valid_to: formData.valid_to,
        usage_limit: Number(formData.usage_limit) || 999,
      };
      await offersApi.createCoupon(payload);
      toast.success(`Coupon ${payload.code} created successfully!`);
      setCreateDialogOpen(false);
      resetForm();
      await fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Failed to create coupon");
    }
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toString(),
      min_order: coupon.min_order.toString(),
      max_discount: coupon.max_discount?.toString() || "",
      valid_from: coupon.valid_from,
      valid_to: coupon.valid_to,
      usage_limit: coupon.usage_limit.toString(),
    });
    setCreateDialogOpen(true);
  };

  const handleUpdateCoupon = async () => {
    if (!editingCoupon) return;

    try {
      const payload = {
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: Number(formData.value),
        min_order: Number(formData.min_order),
        max_discount: formData.max_discount ? Number(formData.max_discount) : undefined,
        valid_from: formData.valid_from,
        valid_to: formData.valid_to,
        usage_limit: Number(formData.usage_limit),
      };
      await offersApi.updateCoupon(editingCoupon.id, payload);
      toast.success(`Coupon ${formData.code} updated successfully!`);
      setCreateDialogOpen(false);
      resetForm();
      await fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Failed to update coupon");
    }
  };

  const toggleCouponStatus = async (couponId: string) => {
    const coupon = coupons.find(c => c.id === couponId);
    if (!coupon) return;

    const newStatus = (coupon.status === "expired" || coupon.status === "disabled") ? "active" : "disabled";
    try {
      await offersApi.updateCoupon(couponId, { status: newStatus });
      toast.success("Coupon status updated");
      await fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    const coupon = coupons.find((c) => c.id === couponId);
    try {
      await offersApi.deleteCoupon(couponId);
      toast.success(`Coupon ${coupon?.code} deleted successfully!`);
      await fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete coupon");
    }
  };

  const copyCouponCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Coupon code "${code}" copied!`);
  };

  // Membership Plan Functions
  const handleEditPlan = (plan: MembershipPlan) => {
    const tierBenefits = getTierBenefits(plan.tier);
    setEditingPlan(plan);
    setPlanFormData({
      name: getTierDisplayName(plan.tier),
      tier: plan.tier,
      monthlyPrice: plan.monthlyPrice.toString(),
      loyaltyBonus: tierBenefits.loyaltyBonus.toString(),
      exclusiveCoupons: tierBenefits.exclusiveCoupons,
      freeDelivery: tierBenefits.freeDelivery,
      prioritySupport: tierBenefits.prioritySupport,
    });
    setPlanDialogOpen(true);
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;

    try {
      const tierBenefits = getTierBenefits(planFormData.tier);
      const payload = {
        name: getTierDisplayName(planFormData.tier),
        tier: planFormData.tier,
        monthlyPrice: Number(planFormData.monthlyPrice),
        benefits: tierBenefits,
      };
      await offersApi.updateMembership(editingPlan.id, payload);
      toast.success(`${payload.name} updated successfully!`);
      setPlanDialogOpen(false);
      resetPlanForm();
      await fetchMemberships();
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan");
    }
  };

  const handleAddPlan = async () => {
    if (!planFormData.name || !planFormData.monthlyPrice) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const tierBenefits = getTierBenefits(planFormData.tier);
      const payload = {
        name: getTierDisplayName(planFormData.tier),
        tier: planFormData.tier,
        monthlyPrice: Number(planFormData.monthlyPrice),
        benefits: tierBenefits,
      };
      await offersApi.createMembership(payload);
      toast.success(`${payload.name} created successfully!`);
      setPlanDialogOpen(false);
      resetPlanForm();
      await fetchMemberships();
    } catch (err: any) {
      toast.error(err.message || "Failed to create plan");
    }
  };

  const togglePlanStatus = async (planId: string) => {
    const plan = membershipPlans.find(p => p.id === planId);
    if (!plan) return;

    const newStatus = plan.status === "active" ? "inactive" : "active";
    try {
      await offersApi.updateMembership(planId, { status: newStatus });
      toast.success("Plan status updated");
      await fetchMemberships();
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan status");
    }
  };

  // Loyalty Configuration Functions
  const handleSaveLoyaltyConfig = async () => {
    try {
      await offersApi.updateLoyaltyConfig(loyaltyConfig);
      toast.success("Loyalty points configuration saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save loyalty config");
    }
  };

  // Feedback Functions
  const resetFeedbackForm = () => {
    setFeedbackFormData({
      customerName: "",
      customerId: "",
      orderId: "",
      rating: 5,
      comment: "",
    });
  };

  const handleCreateFeedback = async () => {
    if (
      !feedbackFormData.customerName ||
      !feedbackFormData.customerId ||
      !feedbackFormData.orderId ||
      !feedbackFormData.comment
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const result = await offersApi.createFeedback({
        customerName: feedbackFormData.customerName,
        customerId: feedbackFormData.customerId,
        orderId: feedbackFormData.orderId,
        rating: feedbackFormData.rating,
        comment: feedbackFormData.comment,
      });
      toast.success(result.message || `Feedback submitted! You earned ${result.pointsAwarded} loyalty points!`);
      resetFeedbackForm();
      await fetchFeedback();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit feedback");
    }
  };

  // Calculate feedback statistics
  const feedbackStats = {
    totalFeedback: feedbacks.length,
    averageRating:
      feedbacks.filter((f) => f.rating > 0).length > 0
        ? (
            feedbacks
              .filter((f) => f.rating > 0)
              .reduce((sum, f) => sum + f.rating, 0) /
            feedbacks.filter((f) => f.rating > 0).length
          ).toFixed(1)
        : "0.0",
  };

  // Filter coupons by search query
  const filteredCoupons = coupons.filter((coupon) => {
    const query = searchQuery.toLowerCase();
    return (
      coupon.code.toLowerCase().includes(query) ||
      coupon.type.toLowerCase().includes(query) ||
      coupon.status.toLowerCase().includes(query)
    );
  });

  const activeMembershipPlans = membershipPlans.filter(
    (plan) => plan.status === "active",
  ).length;

  if (loading) return <LoadingOffers />;

  return (
    <div className="min-h-screen bg-[#f8f8f8] px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 max-w-full overflow-x-hidden">

      {/* Tab Navigation */}
      <div className="w-full overflow-x-auto pb-2">
        <nav className="flex gap-3 min-w-max p-1">
          {[
            {
              id: "coupons",
              label: "Coupons",
              icon: Tag,
              description: "Manage promo codes",
            },
            {
              id: "membership",
              label: "Membership Plans",
              icon: Crown,
              description: "Subscription tiers",
            },
            {
              id: "loyalty",
              label: "Loyalty Config",
              icon: Star,
              description: "Points & rewards",
            },
            {
              id: "feedback",
              label: "Feedback",
              icon: MessageSquare,
              description: "Customer reviews",
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl transition-colors text-left min-w-[200px] border shadow-sm",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-border hover:bg-gray-50",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 mt-0.5 flex-shrink-0",
                    isActive ? "text-primary-foreground" : "text-muted-foreground",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isActive ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-0.5",
                      isActive
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-0"
      >
        {/* ==================== TAB 1: COUPONS (EXISTING) ==================== */}
        <TabsContent value="coupons" className="space-y-4">
          {/* Search & Create Button */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-[#e7ded4] rounded-2xl shadow-sm p-3 sm:p-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search coupons by code / type / status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white text-foreground placeholder:text-muted-foreground border border-border shadow-sm"
              />
            </div>

            <Dialog
              open={createDialogOpen}
              onOpenChange={(open) => {
                setCreateDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 shadow-sm bg-white text-[#8B5A2B] border border-[#e7ded4] hover:bg-gray-50">
                  <Plus className="h-5 w-5" />
                  Create Coupon
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingCoupon
                      ? "Modify Coupon"
                      : "Design Coupon"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCoupon
                      ? "Refine your coupon details"
                      : "Craft a compelling promotional offer"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Coupon Code *</Label>
                    <Input
                      placeholder="e.g., SAVE20"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      className="uppercase font-mono bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Discount Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(
                          value: "percentage" | "flat",
                        ) =>
                          setFormData({
                            ...formData,
                            type: value,
                          })
                        }
                      >
                        <SelectTrigger className="bg-input-background text-foreground border-input dark:bg-input-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">
                            Percentage (%)
                          </SelectItem>
                          <SelectItem value="flat">
                            Flat Amount (₹)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Discount Value *</Label>
                      <Input
                        type="number"
                        placeholder={
                          formData.type === "percentage"
                            ? "e.g., 20"
                            : "e.g., 100"
                        }
                        value={formData.value}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            value: e.target.value,
                          })
                        }
                        className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Order Value (₹) *</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 500"
                        value={formData.min_order}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            min_order: e.target.value,
                          })
                        }
                        className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Discount (₹)</Label>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={formData.max_discount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            max_discount: e.target.value,
                          })
                        }
                        className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valid From *</Label>
                      <Input
                        type="date"
                        value={formData.valid_from}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valid_from: e.target.value,
                          })
                        }
                        className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Valid To *</Label>
                      <Input
                        type="date"
                        value={formData.valid_to}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valid_to: e.target.value,
                          })
                        }
                        className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Usage Limit</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 100 (default: unlimited)"
                      value={formData.usage_limit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          usage_limit: e.target.value,
                        })
                      }
                      className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={
                      editingCoupon
                        ? handleUpdateCoupon
                        : handleCreateCoupon
                    }
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    {editingCoupon
                      ? "Update Coupon"
                      : "Create Coupon"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Coupons Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">
                      COUPON CODE
                    </TableHead>
                    <TableHead className="font-semibold">
                      DISCOUNT TYPE
                    </TableHead>
                    <TableHead className="font-semibold">
                      DISCOUNT VALUE
                    </TableHead>
                    <TableHead className="font-semibold">
                      MIN ORDER AMOUNT
                    </TableHead>
                    <TableHead className="font-semibold">
                      EXPIRY DATE
                    </TableHead>
                    <TableHead className="font-semibold">
                      STATUS
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      ACTIONS
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No coupons found</p>
                        {searchQuery && (
                          <p className="text-sm mt-1">
                            Try adjusting your search
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCoupons.map((coupon) => (
                      <TableRow
                        key={coupon.id}
                        className="hover:bg-muted/30"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="font-mono font-bold text-orange-600 cursor-pointer hover:text-orange-700"
                              onClick={() =>
                                copyCouponCode(coupon.code)
                              }
                            >
                              {coupon.code}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() =>
                                copyCouponCode(coupon.code)
                              }
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">
                            {coupon.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {coupon.type === "percentage" ? (
                            <span>{coupon.value}%</span>
                          ) : (
                            <span className="flex items-center">
                              <IndianRupee className="h-3 w-3" />
                              {coupon.value}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center">
                            <IndianRupee className="h-3 w-3" />
                            {coupon.min_order}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(
                            coupon.valid_to,
                          ).toLocaleDateString("en-GB")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              coupon.status === "active"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : coupon.status === "expired"
                                  ? "bg-red-100 text-red-700 hover:bg-red-100"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                            }
                          >
                            {coupon.status === "active"
                              ? "Active"
                              : coupon.status === "expired"
                                ? "Expired"
                                : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleEditCoupon(coupon)
                              }
                              className="h-8 gap-1"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </Button>

                            {coupon.status === "active" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  toggleCouponStatus(coupon.id)
                                }
                                className="h-8 gap-1"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Disable
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() =>
                                  toggleCouponStatus(coupon.id)
                                }
                                className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Enable
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleDeleteCoupon(coupon.id)
                              }
                              className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Coupon Statistics */}
          <div className="grid gap-4 md:grid-cols-3 items-stretch">
            <Card className="h-full rounded-2xl border border-[#e7ded4] shadow-sm bg-white">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Total Coupons
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="text-xl sm:text-2xl font-bold text-[#2D2D2D]">
                  {coupons.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All coupon codes
                </p>
              </CardContent>
            </Card>

            <Card className="h-full rounded-2xl border border-[#e7ded4] shadow-sm bg-white">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Active Coupons
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="text-xl sm:text-2xl font-bold text-green-600">
                  {
                    coupons.filter((c) => c.status === "active")
                      .length
                  }
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Currently active
                </p>
              </CardContent>
            </Card>

            <Card className="h-full rounded-2xl border border-[#e7ded4] shadow-sm bg-white">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Total Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="text-xl sm:text-2xl font-bold text-[#2D2D2D]">
                  {coupons.reduce(
                    (sum, c) => sum + c.usage_count,
                    0,
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Times redeemed
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== TAB 2: MEMBERSHIP PLANS ==================== */}
        <TabsContent value="membership" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                Membership Plans
              </h2>
              <p className="text-gray-200 mt-1">
                Manage subscription plans for customers
              </p>
            </div>
            <Button onClick={() => {
              resetPlanForm();
              setPlanDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Membership Plan
            </Button>
          </div>

          {/* Plan Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {membershipPlans.map((plan) => (
              <Card
                key={plan.id}
                className="border-2 border-border bg-card"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 bg-white rounded-full ${plan.color}`}
                      >
                        {plan.icon}
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {plan.name}
                        </CardTitle>
                        <Badge
                          className={
                            plan.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }
                        >
                          {plan.status === "active"
                            ? "Active"
                            : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pricing */}
                  <div className="flex items-baseline gap-1">
                    <IndianRupee className="h-5 w-5 mt-1" />
                    <span className="text-3xl font-bold">
                      {plan.monthlyPrice}
                    </span>
                    <span className="text-muted-foreground">
                      {plan.billingCycle}
                    </span>
                  </div>

                  <Separator />

                  {/* Benefits */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">
                      Benefits
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">
                            Extra Loyalty Points
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="font-semibold"
                        >
                          +{plan.benefits.loyaltyBonus}%
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">
                            Exclusive Coupons
                          </span>
                        </div>
                        {plan.benefits.exclusiveCoupons ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-gray-400" />
                        )}
                      </div>

                      <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-purple-500" />
                          <span className="text-sm">
                            Free Delivery
                          </span>
                        </div>
                        {plan.benefits.freeDelivery ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-gray-400" />
                        )}
                      </div>

                      <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-green-500" />
                          <span className="text-sm">
                            Priority Support
                          </span>
                        </div>
                        {plan.benefits.prioritySupport ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Edit className="h-4 w-4" />
                      Edit Plan
                    </Button>
                    <Button
                      variant={
                        plan.status === "active"
                          ? "destructive"
                          : "default"
                      }
                      className="flex-1 gap-2"
                      onClick={() => togglePlanStatus(plan.id)}
                    >
                      {plan.status === "active" ? (
                        <>
                          <Ban className="h-4 w-4" />
                          Disable
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Enable
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Membership Statistics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {membershipPlans.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All membership plans
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {activeMembershipPlans}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Currently active
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Edit/Add Plan Dialog */}
          <Dialog
            open={planDialogOpen}
            onOpenChange={(open) => {
              setPlanDialogOpen(open);
              if (!open) resetPlanForm();
            }}
          >
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'Edit Membership Plan' : 'Add Membership Plan'}</DialogTitle>
                <DialogDescription>
                  {editingPlan ? 'Update plan details and benefits' : 'Create a new membership plan for customers'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Name *</Label>
                    <Input
                      placeholder="Auto-generated from tier"
                      value={planFormData.name}
                      readOnly
                      className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Plan Tier *</Label>
                    <Select
                      value={planFormData.tier}
                      onValueChange={(value: MembershipTier) => {
                        const tierBenefits = getTierBenefits(value);
                        setPlanFormData({
                          ...planFormData,
                          tier: value,
                          name: getTierDisplayName(value),
                          loyaltyBonus: tierBenefits.loyaltyBonus.toString(),
                          exclusiveCoupons: tierBenefits.exclusiveCoupons,
                          freeDelivery: tierBenefits.freeDelivery,
                          prioritySupport: tierBenefits.prioritySupport,
                        });
                      }}
                      disabled={!!editingPlan}
                    >
                      <SelectTrigger className="bg-input-background text-foreground border-input dark:bg-input-background">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="silver">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-gray-600" />
                            Silver
                          </div>
                        </SelectItem>
                        <SelectItem value="gold">
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-yellow-600" />
                            Gold
                          </div>
                        </SelectItem>
                        <SelectItem value="platinum">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-purple-600" />
                            Platinum
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Price (₹) *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 499"
                      value={planFormData.monthlyPrice}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          monthlyPrice: e.target.value,
                        })
                      }
                      className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Loyalty Bonus (%) *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 25"
                      value={planFormData.loyaltyBonus}
                      readOnly
                      className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>Plan Benefits</Label>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">
                        Exclusive Coupons
                      </span>
                    </div>
                    <Switch
                      checked={planFormData.exclusiveCoupons}
                      disabled
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">
                        Free Delivery
                      </span>
                    </div>
                    <Switch
                      checked={planFormData.freeDelivery}
                      disabled
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        Priority Support
                      </span>
                    </div>
                    <Switch
                      checked={planFormData.prioritySupport}
                      disabled
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPlanDialogOpen(false);
                    resetPlanForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={editingPlan ? handleUpdatePlan : handleAddPlan}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ==================== TAB 3: LOYALTY POINTS CONFIGURATION ==================== */}
        <TabsContent value="loyalty" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white drop-shadow-lg">
              Loyalty Points Configuration
            </h2>
            <p className="text-gray-200 mt-1">
              Reward customers for repeat orders
            </p>
          </div>

          {/* Points Earning Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-orange-500" />
                Points Earning Rules
              </CardTitle>
              <CardDescription>
                Configure how customers earn loyalty points
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Points Per ₹100 Spent</Label>
                  <Input
                    type="number"
                    value={loyaltyConfig.pointsPerHundred}
                    onChange={(e) =>
                      setLoyaltyConfig({
                        ...loyaltyConfig,
                        pointsPerHundred: Number(
                          e.target.value,
                        ),
                      })
                    }
                    className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customers earn{" "}
                    {loyaltyConfig.pointsPerHundred} points for
                    every ₹100 spent
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum Points Per Order</Label>
                  <Input
                    type="number"
                    value={loyaltyConfig.maxPointsPerOrder}
                    onChange={(e) =>
                      setLoyaltyConfig({
                        ...loyaltyConfig,
                        maxPointsPerOrder: Number(
                          e.target.value,
                        ),
                      })
                    }
                    className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cap points earned at{" "}
                    {loyaltyConfig.maxPointsPerOrder} per single
                    order
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium">
                      Enable Loyalty Program
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Allow customers to earn and redeem points
                    </p>
                  </div>
                </div>
                <Switch
                  checked={loyaltyConfig.loyaltyEnabled}
                  onCheckedChange={(checked) =>
                    setLoyaltyConfig({
                      ...loyaltyConfig,
                      loyaltyEnabled: checked,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Points Redemption Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-blue-500" />
                Points Redemption Rules
              </CardTitle>
              <CardDescription>
                Set rules for how customers can use their points
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Points Required Per ₹1 Discount</Label>
                  <Input
                    type="number"
                    value={loyaltyConfig.pointsPerRupee}
                    onChange={(e) =>
                      setLoyaltyConfig({
                        ...loyaltyConfig,
                        pointsPerRupee: Number(e.target.value),
                      })
                    }
                    className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    {loyaltyConfig.pointsPerRupee} points = ₹1
                    discount
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Minimum Redeemable Points</Label>
                  <Input
                    type="number"
                    value={loyaltyConfig.minRedeemablePoints}
                    onChange={(e) =>
                      setLoyaltyConfig({
                        ...loyaltyConfig,
                        minRedeemablePoints: Number(
                          e.target.value,
                        ),
                      })
                    }
                    className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Customers must have at least{" "}
                    {loyaltyConfig.minRedeemablePoints} points
                    to redeem
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Points Expiry Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                Points Expiry Settings
              </CardTitle>
              <CardDescription>
                Manage point expiration policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Points Expiry Duration (Months)</Label>
                <Input
                  type="number"
                  value={loyaltyConfig.expiryMonths}
                  onChange={(e) =>
                    setLoyaltyConfig({
                      ...loyaltyConfig,
                      expiryMonths: Number(e.target.value),
                    })
                  }
                  className="bg-input-background text-foreground placeholder:text-muted-foreground border-input dark:bg-input-background"
                />
                <p className="text-xs text-muted-foreground">
                  Points will expire after{" "}
                  {loyaltyConfig.expiryMonths} months of
                  inactivity
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium">
                      Enable Auto-Expiry
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Automatically expire points after set
                      duration
                    </p>
                  </div>
                </div>
                <Switch
                  checked={loyaltyConfig.autoExpiryEnabled}
                  onCheckedChange={(checked) =>
                    setLoyaltyConfig({
                      ...loyaltyConfig,
                      autoExpiryEnabled: checked,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Configuration Summary */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Configuration Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">
                    Example Calculation:
                  </span>{" "}
                  A customer who spends ₹1,000 will earn{" "}
                  <span className="font-bold text-blue-600">
                    {Math.floor(
                      (1000 / 100) *
                        loyaltyConfig.pointsPerHundred,
                    )}{" "}
                    points
                  </span>
                  . To redeem ₹50 discount, they need{" "}
                  <span className="font-bold text-blue-600">
                    {50 * loyaltyConfig.pointsPerRupee} points
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Points{" "}
                  {loyaltyConfig.autoExpiryEnabled
                    ? "will"
                    : "will not"}{" "}
                  expire after {loyaltyConfig.expiryMonths}{" "}
                  months. Loyalty program is currently{" "}
                  {loyaltyConfig.loyaltyEnabled
                    ? "enabled"
                    : "disabled"}
                  .
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSaveLoyaltyConfig}
              className="gap-2"
            >
              <Save className="h-5 w-5" />
              Save Configuration
            </Button>
          </div>
        </TabsContent>

        {/* ==================== TAB 4: FEEDBACK MODULE ==================== */}
        <TabsContent value="feedback" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white drop-shadow-lg">
                Customer Feedback
              </h2>
              <p className="text-gray-200 mt-1">
                Collect and manage customer reviews
              </p>
            </div>
          </div>

          {/* Feedback Statistics */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Total Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {feedbackStats.totalFeedback}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Customer reviews received
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Average Rating
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-yellow-600">
                    {feedbackStats.averageRating}
                  </div>
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <=
                          parseFloat(
                            feedbackStats.averageRating,
                          )
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Overall customer satisfaction
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feedback Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Feedback</CardTitle>
              <CardDescription>
                Complete list of customer reviews and ratings
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">
                      CUSTOMER
                    </TableHead>
                    <TableHead className="font-semibold">
                      ORDER ID
                    </TableHead>
                    <TableHead className="font-semibold">
                      RATING
                    </TableHead>
                    <TableHead className="font-semibold">
                      COMMENT
                    </TableHead>
                    <TableHead className="font-semibold">
                      DATE
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbacks.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No feedback received yet</p>
                        <p className="text-sm mt-1">
                          Encourage customers to share their
                          experience
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    feedbacks.map((feedback) => (
                      <TableRow
                        key={feedback.id}
                        className="hover:bg-muted/30"
                      >
                        <TableCell>
                          <div>
                            <p className="font-semibold">
                              {feedback.customerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {feedback.customerId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {feedback.orderId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= feedback.rating
                                    ? "fill-current text-yellow-500"
                                    : "text-muted-foreground/40"
                                }`}
                              />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p
                            className="text-sm truncate"
                            title={feedback.comment}
                          >
                            {feedback.comment}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {feedback.submittedAt &&
                          !Number.isNaN(
                            new Date(feedback.submittedAt).getTime(),
                          )
                            ? new Date(
                                feedback.submittedAt,
                              ).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Information Panel */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                About Customer Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Instant Rewards
                    </p>
                    <p className="text-muted-foreground">
                      Customers automatically receive 10 loyalty
                      points when feedback is submitted
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <Star className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Encourage Participation
                    </p>
                    <p className="text-muted-foreground">
                      No approval delays - points are awarded
                      immediately to motivate more customer
                      feedback
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Track Satisfaction
                    </p>
                    <p className="text-muted-foreground">
                      Monitor customer ratings and reviews to
                      identify areas of improvement and
                      celebrate successes
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}