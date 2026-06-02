import { useEffect, useMemo, useState } from 'react';
import { Gift, Award, CheckCircle, Tag, Calendar, ShoppingCart, Lock, Sparkles, TrendingUp, MessageSquare, CreditCard, Percent, Clock, Crown, Star, Zap, Info, AlertCircle, Loader2 } from 'lucide-react';
import type { User } from '@/client/app/App';
import { useLoyalty, type LoyaltyHistoryTab } from '@/client/app/context/LoyaltyContext';
import {
  fetchLoyaltyConfig,
  fetchActiveCoupons,
  fetchMembershipPlans,
  DEFAULT_LOYALTY_CONFIG,
  type LoyaltyConfigRemote,
  type AdminCoupon,
  type MembershipPlan,
} from '@/client/api/config';

interface OffersLoyaltyProps {
  user: User;
  onUpdateUser?: (user: User) => Promise<void> | void;
}

const DEFAULT_MEMBERSHIP: NonNullable<User["membership"]> = {
  plan: 'gold',
  status: 'active',
  monthlyPrice: 299,
  pointsBoost: 25,
  benefits: [
    '+25% loyalty points on all orders',
    'Exclusive member-only coupons',
    'Free delivery on orders above 500',
    'Priority customer support'
  ],
  expiryDate: '2026-06-30'
};

// Admin Loyalty Configuration Interface
interface AdminLoyaltyConfig {
  isEnabled: boolean;
  pointsPerRupee: number; // e.g., 1 point per 10 rupees = 0.1
  maxPointsPerOrder: number | null; // null means no cap
  minRedeemablePoints: number;
  pointsToDiscountRatio: number; // e.g., 100 points = 1 rupee discount
  pointsExpiryMonths: number | null; // null means never expires
  feedbackBonusPoints: number;
  membershipBonusEnabled: boolean;
}

// Admin-hosted coupon interface
interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  expiryDate: string;
  isActive: boolean;
  maxUsage?: number;
  currentUsage?: number;
}

// Admin-defined rewards
interface Reward {
  id: number;
  name: string;
  points: number;
  description: string;
  rewardType: 'discount' | 'free_item' | 'special';
  rewardValue?: number;
  icon?: string;
}

const toPercentClass = (value: number): string => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return `ds-w-pct-${clamped}`;
};

/** Ensure benefits always comes back as a string[], regardless of how the backend stored it. */
function toBenefitsArray(benefits: unknown): string[] {
  if (Array.isArray(benefits)) return benefits as string[];
  if (typeof benefits === 'string' && benefits.trim()) {
    return benefits.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default function OffersLoyalty({ user, onUpdateUser }: OffersLoyaltyProps) {
  const loyalty = useLoyalty();
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [redeemedRewards, setRedeemedRewards] = useState<number[]>([]);
  const [historyTab, setHistoryTab] = useState<LoyaltyHistoryTab>('all');

  // ── Live data from admin backend ─────────────────────────────────────────
  const [remoteLoyaltyConfig, setRemoteLoyaltyConfig] = useState<LoyaltyConfigRemote>(DEFAULT_LOYALTY_CONFIG);
  const [adminCoupons, setAdminCoupons] = useState<Coupon[]>([]);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchLoyaltyConfig(),
      fetchActiveCoupons(),
      fetchMembershipPlans(),
    ]).then(([loyConfig, rawCoupons, plans]) => {
      setRemoteLoyaltyConfig(loyConfig);
      // Map AdminCoupon (snake_case backend) → internal Coupon interface
      setAdminCoupons(
        rawCoupons.map((c: AdminCoupon) => ({
          id: (c as any)._id || c.id || c.code,
          code: c.code,
          description:
            c.description ||
            `${c.type === 'percentage' ? c.value + '% off' : '₹' + c.value + ' off'} on orders above ₹${c.min_order}`,
          discountType: (c.type === 'flat' ? 'fixed' : 'percentage') as 'fixed' | 'percentage',
          discountValue: c.value,
          minOrderValue: c.min_order,
          expiryDate: c.valid_to,
          isActive: c.status === 'active',
          maxUsage: c.usage_limit || undefined,
          currentUsage: c.usage_count || 0,
        }))
      );
      // Normalise benefits to always be string[]
      setMembershipPlans(plans.map((p) => ({ ...p, benefits: toBenefitsArray(p.benefits) })));
    }).finally(() => setLoadingOffers(false));
  }, []);

  // Derive loyaltyAdmin from live config (falls back to defaults until loaded)
  const loyaltyAdmin: AdminLoyaltyConfig = {
    isEnabled: remoteLoyaltyConfig.loyaltyEnabled,
    pointsPerRupee: remoteLoyaltyConfig.pointsPerHundred / 100,
    maxPointsPerOrder: remoteLoyaltyConfig.maxPointsPerOrder,
    minRedeemablePoints: remoteLoyaltyConfig.minRedeemablePoints,
    pointsToDiscountRatio: remoteLoyaltyConfig.pointsPerRupee,
    pointsExpiryMonths: remoteLoyaltyConfig.expiryMonths,
    feedbackBonusPoints: 10,
    membershipBonusEnabled: false,
  };

  // Calculate membership bonus percentage based on membership tier
  const getMembershipBonus = (): number => {
    if (!loyaltyAdmin.membershipBonusEnabled || !user.membership || user.membership.plan === 'none') {
      return 0;
    }
    return user.membership.pointsBoost;
  };

  // Calculate points that would be earned from an order amount
  const calculatePointsEarned = (orderAmount: number): number => {
    if (!loyaltyAdmin.isEnabled) return 0;
    
    let basePoints = Math.floor(orderAmount / 100) * remoteLoyaltyConfig.pointsPerHundred;
    
    // Apply membership bonus
    const membershipBonus = getMembershipBonus();
    if (membershipBonus > 0) {
      basePoints = Math.floor(basePoints * (1 + membershipBonus / 100));
    }
    
    // Apply max cap if set
    if (loyaltyAdmin.maxPointsPerOrder !== null) {
      basePoints = Math.min(basePoints, loyaltyAdmin.maxPointsPerOrder);
    }
    
    return basePoints;
  };

  // Calculate discount from points
  const calculatePointsDiscount = (points: number): number => {
    if (points < loyaltyAdmin.minRedeemablePoints) return 0;
    return Math.floor(points / loyaltyAdmin.pointsToDiscountRatio);
  };

  const filteredHistory = useMemo(() => {
    const items = loyalty.history;
    switch (historyTab) {
      case 'earned':
        return items.filter((h) => h.type === 'EARN');
      case 'redeemed':
        return items.filter((h) => h.type === 'REDEEM');
      case 'expired':
        return items.filter((h) => h.type === 'EXPIRE');
      case 'all':
      default:
        return items;
    }
  }, [historyTab, loyalty.history]);
  
  // Admin-defined reward catalog (static fallback; later driven by admin rewards API)
  const rewards: Reward[] = [
    {
      id: 1,
      name: 'Free Appetizer',
      points: 200,
      description: 'Redeem for any appetizer of your choice',
      rewardType: 'free_item',
      icon: '🥗'
    },
    {
      id: 2,
      name: '₹100 Discount',
      points: 300,
      description: 'Get ₹100 off on your next order',
      rewardType: 'discount',
      rewardValue: 100,
      icon: '💰'
    },
    {
      id: 3,
      name: 'Free Main Course',
      points: 500,
      description: 'Redeem for any main course dish',
      rewardType: 'free_item',
      icon: '🍛'
    },
    {
      id: 4,
      name: 'Premium Dining',
      points: 1000,
      description: 'Free meal for two with complimentary drinks',
      rewardType: 'special',
      icon: '✨'
    }
  ];

  const currentPoints = loyalty.balancePoints;

  // Calculate next reward milestone
  const getNextRewardMilestone = () => {
    const sortedRewards = [...rewards].sort((a, b) => a.points - b.points);
    const nextReward = sortedRewards.find((r) => r.points > currentPoints);
    return nextReward || sortedRewards[sortedRewards.length - 1];
  };

  const nextReward = getNextRewardMilestone();
  const progressPercentage = Math.min(100, (currentPoints / nextReward.points) * 100);

  // Check coupon eligibility
  const isCouponEligible = (coupon: Coupon, orderValue: number = 500) => {
    const isExpired = new Date(coupon.expiryDate) < new Date();
    const meetsMinOrder = orderValue >= coupon.minOrderValue;
    const hasUsageLeft = !coupon.maxUsage || (coupon.currentUsage || 0) < coupon.maxUsage;
    
    return coupon.isActive && !isExpired && meetsMinOrder && hasUsageLeft;
  };

  const handleApplyCoupon = (couponCode: string) => {
    if (appliedCoupon === couponCode) {
      setAppliedCoupon(null);
    } else {
      setAppliedCoupon(couponCode);
    }
  };

  const handleRedeemReward = (rewardId: number) => {
    if (!redeemedRewards.includes(rewardId)) {
      setRedeemedRewards([...redeemedRewards, rewardId]);
    }
  };

  // Check if reward is available
  const isRewardAvailable = (reward: Reward) => {
    return currentPoints >= reward.points;
  };

  // Calculate discount for preview
  const calculateDiscount = (orderAmount: number = 650) => {
    let totalDiscount = 0;

    // Apply coupon discount
    if (appliedCoupon) {
      const coupon = adminCoupons.find((c) => c.code === appliedCoupon);
      if (coupon && isCouponEligible(coupon, orderAmount)) {
        if (coupon.discountType === 'percentage') {
          totalDiscount += (orderAmount * coupon.discountValue) / 100;
        } else {
          totalDiscount += coupon.discountValue;
        }
      }
    }

    // Apply redeemed rewards
    redeemedRewards.forEach((rewardId) => {
      const reward = rewards.find((r) => r.id === rewardId);
      if (reward && reward.rewardType === 'discount' && reward.rewardValue) {
        totalDiscount += reward.rewardValue;
      }
    });

    return totalDiscount;
  };
  return (
    <div className="offers-loyalty-page min-h-screen bg-[#FAF7F2] py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 
            className="text-2xl font-semibold mb-2 text-[#3E2723]" 
           
          >
            Offers & Loyalty Rewards
          </h1>
          <p className="text-[#6D4C41]/80 text-sm sm:text-base">Earn points with every order and redeem exclusive rewards</p>
        </div>

        {/* Enhanced Loyalty Points Card */}
        {loyaltyAdmin.isEnabled ? (
          <div className="bg-gradient-to-br from-[#3E2723] via-[#4E342E] to-[#6D4C41] text-white rounded-3xl shadow-2xl p-10 mb-12 relative overflow-hidden border-2 border-[#C8A47A]/20">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#C8A47A]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8B5A2B]/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-6">
                    {Math.min(100, (currentPoints / loyaltyAdmin.minRedeemablePoints) * 100).toFixed(0)}%
                <div className="w-16 h-16 bg-[#C8A47A]/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-[#C8A47A]/30">
                  <Award className="w-8 h-8 text-[#C8A47A]" />
                </div>
                <div>
                  <p className="text-[#FAF7F2]/70 text-sm font-medium mb-1">Your Loyalty Points</p>
                  <p className="text-5xl font-black text-[#C8A47A]">{currentPoints}</p>
                  <p className="text-[#FAF7F2]/60 text-xs mt-1 italic flex items-center gap-1">
                    Earned based on ₹ spent and admin-defined rules
                    {remoteLoyaltyConfig.expiryMonths && (
                      <span className="inline-flex items-center gap-1 ml-2 bg-[#C8A47A]/20 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        Expires in {remoteLoyaltyConfig.expiryMonths} months
                      </span>
                    )}
                  </p>
                </div>
                      {loyaltyAdmin.minRedeemablePoints - currentPoints} more to redeem rewards
              
              <div className="flex flex-col items-end gap-2">
                <div className="bg-[#C8A47A]/20 backdrop-blur-sm px-6 py-3 rounded-full border border-[#C8A47A]/30">
                  <p className="text-xs text-[#FAF7F2]/70 uppercase tracking-wider font-bold">Member Status</p>
                  <p className="text-lg font-bold text-[#C8A47A]">
                    {user.membership && user.membership.plan !== 'none' 
                      ? user.membership.plan.charAt(0).toUpperCase() + user.membership.plan.slice(1)
                      : 'Standard'}
                  </p>
                </div>
              </div>
            </div>

            {/* Enhanced Progress Bar - Based on Minimum Redeemable Points */}
            <div className="bg-[#2D1B10]/50 backdrop-blur-sm rounded-2xl p-6 border border-[#C8A47A]/20">
              <div className="flex justify-between text-sm mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#C8A47A]" />
                  <span className="text-[#FAF7F2]/90 font-semibold">Progress to redeemable points</span>
                </div>
                <span className="font-bold text-[#C8A47A]">
                  {Math.min(100, (currentPoints / loyaltyAdmin.minRedeemablePoints) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-[#1A110D] rounded-full h-4 overflow-hidden mb-3 border border-[#C8A47A]/20">
                <div
                  className={`bg-gradient-to-r from-[#C8A47A] to-[#8B5A2B] h-full rounded-full transition-all duration-500 relative ${toPercentClass(Math.min(100, (currentPoints / loyaltyAdmin.minRedeemablePoints) * 100))}`}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-[#FAF7F2]/70">
                  <span className="font-bold text-[#C8A47A]">{currentPoints}</span> / {loyaltyAdmin.minRedeemablePoints} points
                </p>
                {currentPoints < loyaltyAdmin.minRedeemablePoints ? (
                  <p className="text-xs text-[#FAF7F2]/60">
                    {loyaltyAdmin.minRedeemablePoints - currentPoints} more to redeem rewards
                  </p>
                ) : (
                  <p className="text-xs text-green-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Ready to redeem!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl shadow-lg p-10 mb-12 relative overflow-hidden border-2 border-gray-300">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Loyalty Program Currently Unavailable
              </h3>
              <p className="text-gray-600 text-sm">
                The loyalty rewards program has been temporarily disabled by the administrator.
              </p>
            </div>
          </div>
        )}
        
        {/* My Membership Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#8B5A2B]/10 rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-[#8B5A2B]" />
            </div>
            <div>
              <h2 
                className="text-lg font-semibold text-[#3E2723]" 
               
              >
                My Membership
              </h2>
              <p className="text-sm text-[#6D4C41]">Unlock exclusive benefits and rewards</p>
            </div>
          </div>

          {user.membership && user.membership.plan !== 'none' ? (
            <div className="bg-gradient-to-br from-[#3E2723] via-[#4E342E] to-[#6D4C41] text-white rounded-3xl shadow-2xl overflow-hidden border-2 border-[#C8A47A]/20 relative">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#C8A47A]/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#8B5A2B]/10 rounded-full blur-3xl"></div>

              <div className="relative z-10 p-10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#C8A47A] to-[#8B5A2B] rounded-2xl flex items-center justify-center border-4 border-white/20">
                      <Crown className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-[#FAF7F2]/60 uppercase tracking-wider font-bold mb-1">Current Plan</p>
                      <h3 
                        className="text-xl font-semibold text-[#C8A47A] capitalize mb-1" 
                       
                      >
                        {user.membership.plan} Membership
                      </h3>
                      <p className="text-[#FAF7F2]/70 text-sm">₹{user.membership.monthlyPrice}/month</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className={`px-6 py-2 rounded-full font-bold text-sm uppercase tracking-wider ${
                      user.membership.status === 'active' 
                        ? 'bg-green-500/20 text-green-300 border-2 border-green-500/50' 
                        : 'bg-gray-500/20 text-gray-300 border-2 border-gray-500/50'
                    }`}>
                      {user.membership.status === 'active' ? '✓ Active' : user.membership.status}
                    </div>
                    {user.membership.expiryDate && (
                      <p className="text-[#FAF7F2]/60 text-xs text-right">
                        Valid until {new Date(user.membership.expiryDate).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Membership Boost Indicator */}
                <div className="bg-[#C8A47A]/20 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-[#C8A47A]/30">
                  <div className="flex items-center gap-3 mb-3">
                    <Zap className="w-6 h-6 text-[#C8A47A]" />
                    <p className="text-[#FAF7F2] font-bold text-lg">Points Boost Active</p>
                  </div>
                  <p className="text-[#FAF7F2]/80 text-sm mb-2">
                    Your membership boosts loyalty points and unlocks exclusive offers
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#1A110D] rounded-full h-2">
                      <div 
                        className={`bg-gradient-to-r from-[#C8A47A] to-[#8B5A2B] h-full rounded-full ${toPercentClass(user.membership.pointsBoost)}`}
                      ></div>
                    </div>
                    <span className="text-[#C8A47A] font-black text-xl">+{user.membership.pointsBoost}%</span>
                  </div>
                </div>

                {/* Benefits Grid */}
                <div>
                  <p className="text-[#FAF7F2]/60 text-xs uppercase tracking-wider font-bold mb-4">Membership Benefits</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {toBenefitsArray(user.membership.benefits).map((benefit, index) => (
                      <div key={index} className="flex items-start gap-3 bg-[#2D1B10]/50 backdrop-blur-sm rounded-xl p-4 border border-[#C8A47A]/20">
                        <div className="w-6 h-6 bg-[#C8A47A]/30 rounded-lg flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-[#C8A47A]" />
                        </div>
                        <p className="text-[#FAF7F2]/90 text-sm font-medium">{benefit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="mt-8 pt-6 border-t border-[#C8A47A]/20">
                  <button className="w-full bg-[#C8A47A]/20 text-[#C8A47A] px-6 py-4 rounded-xl font-bold uppercase tracking-wider cursor-not-allowed opacity-60 border-2 border-[#C8A47A]/30">
                    Active Plan
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border-2 border-[#E8DED0] shadow-lg p-10 text-center">
              <div className="w-24 h-24 bg-[#8B5A2B]/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Crown className="w-12 h-12 text-[#8B5A2B]/50" />
              </div>
              <h3 
                className="text-lg font-semibold text-[#3E2723] mb-3" 
               
              >
                No Active Membership
              </h3>
              <p className="text-[#6D4C41] mb-8 max-w-md mx-auto">
                Upgrade to a membership plan to unlock exclusive benefits, extra loyalty points, and special offers.
              </p>
              <button
                onClick={() => {
                  if (!onUpdateUser) return;
                  // Use first active admin plan if available, else fallback to DEFAULT_MEMBERSHIP
                  const firstPlan = membershipPlans[0];
                  onUpdateUser({
                    ...user,
                    membership: firstPlan
                      ? {
                          plan: firstPlan.tier,
                          status: 'active',
                          monthlyPrice: firstPlan.monthlyPrice,
                          pointsBoost: firstPlan.pointsBoost,
                          benefits: toBenefitsArray(firstPlan.benefits),
                        }
                      : DEFAULT_MEMBERSHIP,
                  });
                }}
                className="bg-gradient-to-r from-[#8B5A2B] to-[#C8A47A] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wider hover:shadow-2xl transition-all"
              >
                {membershipPlans.length > 0 ? `Get ${membershipPlans[0].name} Plan` : 'Activate Membership'}
              </button>
            </div>
          )}
        </div>

        {/* ── Admin-Configured Membership Plans ───────────────────────── */}
        {membershipPlans.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#8B5A2B]/10 rounded-xl flex items-center justify-center">
                <Crown className="w-6 h-6 text-[#8B5A2B]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#3E2723]">
                  Membership Plans
                </h2>
                <p className="text-sm text-[#6D4C41]">Admin-configured plans with exclusive perks</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {membershipPlans.map((plan) => {
                const tierColors: Record<string, { bg: string; badge: string; icon: string }> = {
                  silver: { bg: 'from-gray-400 to-gray-600', badge: 'bg-gray-100 text-gray-700 border-gray-300', icon: '🥈' },
                  gold:   { bg: 'from-[#8B5A2B] to-[#C8A47A]', badge: 'bg-amber-50 text-amber-700 border-amber-300', icon: '🥇' },
                  platinum: { bg: 'from-[#3E2723] to-[#6D4C41]', badge: 'bg-purple-50 text-purple-700 border-purple-300', icon: '👑' },
                };
                const colors = tierColors[plan.tier] || tierColors.gold;
                const isCurrentPlan = user.membership?.plan === plan.tier && user.membership?.status === 'active';

                return (
                  <div key={plan.id} className={`bg-white rounded-2xl border-2 shadow-lg overflow-hidden transition-all ${
                    isCurrentPlan ? 'border-[#8B5A2B] ring-4 ring-[#8B5A2B]/20' : 'border-[#E8DED0] hover:border-[#C8A47A] hover:shadow-xl'
                  }`}>
                    {/* Plan header */}
                    <div className={`bg-gradient-to-br ${colors.bg} p-6 text-white`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl">{colors.icon}</span>
                        {isCurrentPlan && (
                          <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30">
                            ✓ Current Plan
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold capitalize">
                        {plan.name}
                      </h3>
                      <p className="text-white/80 text-lg font-bold mt-1">
                        ₹{plan.monthlyPrice}<span className="text-sm font-normal">/month</span>
                      </p>
                    </div>

                    {/* Plan details */}
                    <div className="p-6">
                      <div className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border mb-4 ${colors.badge}`}>
                        <Zap className="w-3 h-3" />
                        +{plan.pointsBoost}% Points Boost
                      </div>
                      {toBenefitsArray(plan.benefits).length > 0 && (
                        <ul className="space-y-2 mb-5">
                          {toBenefitsArray(plan.benefits).map((b, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[#6D4C41]">
                              <CheckCircle className="w-4 h-4 text-[#8B5A2B] flex-shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => {
                          if (!onUpdateUser || isCurrentPlan) return;
                          onUpdateUser({
                            ...user,
                            membership: {
                              plan: plan.tier,
                              status: 'active',
                              monthlyPrice: plan.monthlyPrice,
                              pointsBoost: plan.pointsBoost,
                              benefits: toBenefitsArray(plan.benefits),
                            },
                          });
                        }}
                        disabled={isCurrentPlan}
                        className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all ${
                          isCurrentPlan
                            ? 'bg-[#8B5A2B] text-white cursor-default'
                            : 'bg-[#3E2723] text-[#C8A47A] hover:bg-[#8B5A2B] hover:text-white border-2 border-[#3E2723]'
                        }`}
                      >
                        {isCurrentPlan ? '✓ Active Plan' : `Get ${plan.name}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin-Hosted Offers Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#8B5A2B]/10 rounded-xl flex items-center justify-center">
              <Tag className="w-6 h-6 text-[#8B5A2B]" />
            </div>
            <div>
              <h2 
                className="text-lg font-semibold text-[#3E2723]" 
               
              >
                Available Offers
              </h2>
              <p className="text-sm text-[#6D4C41]">Admin-curated coupons for exclusive savings</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingOffers ? (
              <div className="col-span-2 flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#8B5A2B]" />
                <span className="ml-3 text-[#6D4C41] font-medium">Loading offers from admin…</span>
              </div>
            ) : adminCoupons.length === 0 ? (
              <div className="col-span-2 text-center py-12">
                <Tag className="w-12 h-12 text-[#C8A47A]/40 mx-auto mb-3" />
                <p className="text-[#6D4C41] font-medium">No active offers configured by admin right now.</p>
                <p className="text-xs text-[#6D4C41]/70 mt-1">Check back soon for exciting deals!</p>
              </div>
            ) : (
              adminCoupons.map((coupon) => {
              const isExpired = new Date(coupon.expiryDate) < new Date();
              const isApplied = appliedCoupon === coupon.code;
              const canApply = isCouponEligible(coupon);
              
              return (
                <div
                  key={coupon.id}
                  className={`bg-white rounded-2xl border-2 shadow-lg overflow-hidden transition-all duration-300 ${
                    isApplied 
                      ? 'border-[#8B5A2B] shadow-[#8B5A2B]/20 scale-[1.02]' 
                      : 'border-[#E8DED0] hover:border-[#C8A47A] hover:shadow-xl'
                  } ${!canApply ? 'opacity-60' : ''}`}
                >
                  {/* Coupon Header */}
                  <div className={`p-6 ${isApplied ? 'bg-gradient-to-r from-[#8B5A2B] to-[#C8A47A]' : 'bg-gradient-to-r from-[#3E2723] to-[#6D4C41]'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Percent className="w-5 h-5 text-[#C8A47A]" />
                          <span className="text-xs font-bold text-[#FAF7F2]/70 uppercase tracking-wider">
                            {coupon.discountType === 'percentage' ? 'Percentage Off' : 'Flat Discount'}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1 tracking-tight">
                          {coupon.code}
                        </h3>
                        <p className="text-sm text-[#FAF7F2]/80">{coupon.description}</p>
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30">
                        <p className="text-2xl font-black text-white">
                          {coupon.discountType === 'percentage' 
                            ? `${coupon.discountValue}%` 
                            : `₹${coupon.discountValue}`}
                        </p>
                        <p className="text-[10px] text-white/70 uppercase tracking-wider font-bold">OFF</p>
                      </div>
                    </div>
                  </div>

                  {/* Coupon Details */}
                  <div className="p-6">
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 bg-[#8B5A2B]/10 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-4 h-4 text-[#8B5A2B]" />
                        </div>
                        <div>
                          <p className="text-[#6D4C41] font-medium">Minimum Order</p>
                          <p className="text-[#3E2723] font-bold">₹{coupon.minOrderValue}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 bg-[#8B5A2B]/10 rounded-lg flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-[#8B5A2B]" />
                        </div>
                        <div>
                          <p className="text-[#6D4C41] font-medium">Valid Until</p>
                          <p className={`font-bold ${isExpired ? 'text-red-600' : 'text-[#3E2723]'}`}>
                            {new Date(coupon.expiryDate).toLocaleDateString('en-GB', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>

                      {coupon.maxUsage && (
                        <div className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 bg-[#8B5A2B]/10 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-[#8B5A2B]" />
                          </div>
                          <div>
                            <p className="text-[#6D4C41] font-medium">Usage Limit</p>
                            <p className="text-[#3E2723] font-bold">
                              {coupon.currentUsage || 0} / {coupon.maxUsage} used
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => canApply && handleApplyCoupon(coupon.code)}
                      disabled={!canApply}
                      className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
                        isApplied
                          ? 'bg-[#8B5A2B] text-white'
                          : canApply
                          ? 'bg-[#3E2723] text-[#C8A47A] hover:bg-[#8B5A2B] hover:text-white border-2 border-[#3E2723]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed border-2 border-gray-300'
                      }`}
                    >
                      {isApplied ? (
                        <span className="flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Applied
                        </span>
                      ) : isExpired ? (
                        'Expired'
                      ) : !canApply ? (
                        <span className="flex items-center justify-center gap-2">
                          <Lock className="w-4 h-4" />
                          Not Eligible
                        </span>
                      ) : (
                        'Apply Coupon'
                      )}
                    </button>

                    {!canApply && !isExpired && (
                      <p className="text-xs text-center text-[#6D4C41] mt-2">
                        Order ₹{coupon.minOrderValue} or more to apply
                      </p>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Refined Rewards Catalog */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#8B5A2B]/10 rounded-xl flex items-center justify-center">
              <Gift className="w-6 h-6 text-[#8B5A2B]" />
            </div>
            <div>
              <h2 
                className="text-lg font-semibold text-[#3E2723]" 
               
              >
                Rewards Catalog
              </h2>
              <p className="text-sm text-[#6D4C41]">Redeem your points for exclusive rewards</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {rewards.map((reward) => {
              const isAvailable = isRewardAvailable(reward);
              const isRedeemed = redeemedRewards.includes(reward.id);
              const pointsNeeded = reward.points - currentPoints;
              
              return (
                <div
                  key={reward.id}
                  className={`bg-white rounded-2xl border-2 shadow-lg overflow-hidden transition-all duration-300 ${
                    isAvailable 
                      ? 'border-[#C8A47A] hover:shadow-2xl hover:-translate-y-1' 
                      : 'border-[#E8DED0] opacity-70'
                  } ${isRedeemed ? 'ring-4 ring-[#8B5A2B]/30' : ''}`}
                >
                  <div className={`p-6 text-center ${isAvailable ? 'bg-gradient-to-br from-[#8B5A2B]/10 to-[#C8A47A]/10' : 'bg-gray-50'}`}>
                    <div
                      className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-4xl ${
                        isAvailable 
                          ? 'bg-gradient-to-br from-[#8B5A2B] to-[#C8A47A]' 
                          : 'bg-gray-200'
                      }`}
                    >
                      {isAvailable ? (
                        reward.icon || <Gift className="w-10 h-10 text-white" />
                      ) : (
                        <Lock className="w-10 h-10 text-gray-400" />
                      )}
                    </div>
                    <h3 
                      className="font-bold text-lg mb-2 text-[#3E2723]" 
                     
                    >
                      {reward.name}
                    </h3>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Award className={`w-4 h-4 ${isAvailable ? 'text-[#8B5A2B]' : 'text-gray-400'}`} />
                      <p className={`text-2xl font-black ${isAvailable ? 'text-[#8B5A2B]' : 'text-gray-400'}`}>
                        {reward.points}
                      </p>
                    </div>
                    <p className="text-xs text-[#6D4C41] uppercase tracking-wider font-bold">Points Required</p>
                  </div>

                  <div className="p-6">
                    <p className="text-sm text-[#6D4C41] text-center mb-6 min-h-[3rem]">
                      {reward.description}
                    </p>

                    <button
                      onClick={() => isAvailable && handleRedeemReward(reward.id)}
                      disabled={!isAvailable || isRedeemed}
                      className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
                        isRedeemed
                          ? 'bg-[#8B5A2B] text-white'
                          : isAvailable
                          ? 'bg-[#3E2723] text-[#C8A47A] hover:bg-[#8B5A2B] hover:text-white border-2 border-[#3E2723]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed border-2 border-gray-300'
                      }`}
                    >
                      {isRedeemed ? (
                        <span className="flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Redeemed
                        </span>
                      ) : isAvailable ? (
                        'Redeem Now'
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Lock className="w-4 h-4" />
                          Locked
                        </span>
                      )}
                    </button>

                    {!isAvailable && (
                      <p className="text-xs text-center text-[#6D4C41] mt-3 font-medium">
                        Need {pointsNeeded} more points
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkout Preview Block */}
        <div className="bg-gradient-to-br from-[#8B5A2B]/10 to-[#C8A47A]/10 rounded-3xl border-2 border-[#C8A47A]/30 p-8 mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#8B5A2B] rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 
                className="text-lg font-semibold text-[#3E2723]" 
               
              >
                Checkout Preview - Example Order
              </h2>
              <p className="text-sm text-[#6D4C41]">See how your rewards and points work together</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="space-y-4">
              {/* Order Subtotal */}
              <div className="flex justify-between items-center pb-4 border-b border-[#E8DED0]">
                <span className="text-[#6D4C41] font-medium">Order Subtotal</span>
                <span className="text-[#3E2723] font-bold text-lg">₹650.00</span>
              </div>

              {/* Points Earned Calculation */}
              <div className="bg-gradient-to-r from-[#8B5A2B]/5 to-[#C8A47A]/5 border-2 border-[#8B5A2B]/20 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#8B5A2B]" />
                    <span className="text-[#3E2723] font-bold">Points You'll Earn</span>
                  </div>
                  <span className="text-[#8B5A2B] font-black text-xl">
                    +{calculatePointsEarned(650)} pts
                  </span>
                </div>
                <div className="text-xs text-[#6D4C41] space-y-1 pl-7">
                  <p>• Base: {Math.floor(650 * loyaltyAdmin.pointsPerRupee)} points (₹650 × {loyaltyAdmin.pointsPerRupee})</p>
                  {getMembershipBonus() > 0 && (
                    <p>• Membership bonus: +{getMembershipBonus()}% = {Math.floor(650 * loyaltyAdmin.pointsPerRupee * (getMembershipBonus() / 100))} extra points</p>
                  )}
                  {remoteLoyaltyConfig.maxPointsPerOrder && calculatePointsEarned(650) >= remoteLoyaltyConfig.maxPointsPerOrder && (
                    <p className="text-amber-600 font-medium">• Capped at maximum {remoteLoyaltyConfig.maxPointsPerOrder} points per order</p>
                  )}
                </div>
              </div>

              {/* Applied Coupon */}
              {appliedCoupon && (() => {
                const coupon = adminCoupons.find(c => c.code === appliedCoupon);
                return coupon && (
                  <div className="flex justify-between items-center py-3 bg-[#8B5A2B]/5 px-4 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-[#8B5A2B]" />
                      <span className="text-[#3E2723] font-medium">
                        Coupon ({coupon.code})
                      </span>
                    </div>
                    <span className="text-green-600 font-bold">
                      - ₹{calculateDiscount(650).toFixed(2)}
                    </span>
                  </div>
                );
              })()}

              {/* Points Redemption Preview */}
              {currentPoints >= loyaltyAdmin.minRedeemablePoints && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-purple-600" />
                      <span className="text-[#3E2723] font-bold">Points Redemption Option</span>
                    </div>
                  </div>
                  <div className="text-xs text-[#6D4C41] space-y-1 pl-7">
                    <p>• You have <strong>{currentPoints} points</strong> available</p>
                    <p>• Redeeming all points = <strong>₹{calculatePointsDiscount(currentPoints).toFixed(0)} discount</strong></p>
                    <p className="text-purple-600">• Conversion: {loyaltyAdmin.pointsToDiscountRatio} points = ₹1</p>
                  </div>
                </div>
              )}

              {/* Redeemed Rewards */}
              {redeemedRewards.length > 0 && (
                <div className="flex justify-between items-center py-3 bg-[#C8A47A]/5 px-4 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-[#8B5A2B]" />
                    <span className="text-[#3E2723] font-medium">
                      Loyalty Rewards Applied ({redeemedRewards.length})
                    </span>
                  </div>
                  <span className="text-green-600 font-bold">Active</span>
                </div>
              )}

              {/* Taxes */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#6D4C41]">Taxes & Charges</span>
                <span className="text-[#3E2723] font-medium">₹32.50</span>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-4 border-t-2 border-[#8B5A2B]">
                <span className="text-[#3E2723] font-bold text-xl">Final Payable Amount</span>
                <div className="text-right">
                  {(appliedCoupon || redeemedRewards.length > 0) && (
                    <p className="text-sm text-gray-400 line-through">
                      ₹682.50
                    </p>
                  )}
                  <p className="text-[#8B5A2B] font-black text-3xl">
                    ₹{(650 - calculateDiscount(650) + 32.50).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Savings Badge */}
              {calculateDiscount(650) > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-700 font-bold text-lg flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    You're saving ₹{calculateDiscount(650).toFixed(2)} on this order!
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900 text-center">
              <strong>Note:</strong> This is an informational preview. Rewards and coupons are automatically applied during actual checkout based on admin-configured rules.
            </p>
          </div>
        </div>

        {/* Loyalty Points History */}
        <div className="bg-white rounded-3xl border-2 border-[#E8DED0] shadow-lg p-8 mb-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#8B5A2B] rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#3E2723]">
                  Loyalty Points History
                </h2>
                <p className="text-sm text-[#6D4C41]">Track earned, redeemed, and expired points</p>
              </div>
            </div>

            <div className="bg-[#8B5A2B]/10 border border-[#8B5A2B]/20 rounded-2xl px-5 py-3">
              <p className="text-xs text-[#6D4C41] font-bold uppercase tracking-wider">Current Balance</p>
              <p className="text-[#3E2723] font-black text-2xl">{currentPoints} pts</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-[#E8DED0]">
            <div className="flex gap-4 overflow-x-auto scrollbar-hide">
              {([
                { id: 'all' as const, label: 'All' },
                { id: 'earned' as const, label: 'Earned' },
                { id: 'redeemed' as const, label: 'Redeemed' },
                ...(remoteLoyaltyConfig.autoExpiryEnabled ? [{ id: 'expired' as const, label: 'Expired' }] : []),
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setHistoryTab(tab.id)}
                  className={`pb-4 px-2 font-medium transition-colors border-b-2 whitespace-nowrap ${
                    historyTab === tab.id
                      ? 'border-[#8B5A2B] text-[#8B5A2B]'
                      : 'border-transparent text-[#6D4C41] hover:text-[#3E2723]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#6D4C41] font-medium">No loyalty transactions yet.</p>
              <p className="text-xs text-[#6D4C41]/80 mt-2">
                Earn points by completing orders, or redeem points in the cart.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((tx) => {
                const isEarn = tx.type === 'EARN';
                const isRedeem = tx.type === 'REDEEM';

                const badgeClass = isEarn
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : isRedeem
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200';

                const pointsClass = isEarn ? 'text-green-700' : 'text-[#3E2723]';
                const pointsSign = isEarn ? '+' : '-';

                return (
                  <div
                    key={tx.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-[#E8DED0] bg-[#FAF7F2]/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#3E2723] truncate">{tx.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-[#6D4C41]">
                          {new Date(tx.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </span>
                        {tx.orderId && (
                          <span className="text-xs text-[#6D4C41]">• Order #{tx.orderId}</span>
                        )}
                        {tx.expiryDate && (
                          <span className="text-xs text-[#6D4C41]">
                            • Expires {new Date(tx.expiryDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4">
                      <span className={`text-lg font-black ${pointsClass}`}>{pointsSign}{tx.points} pts</span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${badgeClass}`}>{tx.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Enhanced How to Earn Points */}
        <div className="bg-white rounded-3xl border-2 border-[#E8DED0] shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 
              className="text-lg font-semibold text-[#3E2723] mb-2" 
             
            >
              How to Earn Points
            </h2>
            <p className="text-[#6D4C41]">Multiple ways to earn and maximize your rewards</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Order Food - Dynamic based on admin config */}
            <div className="text-center p-6 bg-gradient-to-br from-[#8B5A2B]/5 to-[#C8A47A]/5 rounded-2xl border border-[#E8DED0]">
              <div className="w-16 h-16 bg-gradient-to-br from-[#8B5A2B] to-[#C8A47A] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <p className="font-bold text-[#3E2723] mb-2 text-lg">
                Order Food
              </p>
              <p className="text-sm text-[#6D4C41] font-medium mb-2">
                Earn <strong>{Math.floor(loyaltyAdmin.pointsPerRupee * 10)} point{Math.floor(loyaltyAdmin.pointsPerRupee * 10) !== 1 ? 's' : ''}</strong> for every <strong>₹10</strong> spent
              </p>
              {remoteLoyaltyConfig.maxPointsPerOrder && (
                <p className="text-xs text-[#8B5A2B] bg-[#8B5A2B]/10 px-3 py-1 rounded-full inline-block">
                  Max {remoteLoyaltyConfig.maxPointsPerOrder} pts/order
                </p>
              )}
            </div>
            
            {/* Feedback - Dynamic based on admin config */}
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
              <p className="font-bold text-[#3E2723] mb-2 text-lg">
                Submit Feedback
              </p>
              <p className="text-sm text-[#6D4C41] font-medium">
                Earn <strong>+{loyaltyAdmin.feedbackBonusPoints} bonus points</strong> after submitting feedback
              </p>
            </div>
            
            {/* Membership Bonus - Dynamic based on user membership */}
            <div className="text-center p-6 bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <p className="font-bold text-[#3E2723] mb-2 text-lg">
                Membership Bonus
              </p>
              {loyaltyAdmin.membershipBonusEnabled ? (
                <>
                  {user.membership && user.membership.plan !== 'none' ? (
                    <p className="text-sm text-[#6D4C41] font-medium">
                      Your <strong className="capitalize">{user.membership.plan}</strong> membership gives <strong>+{user.membership.pointsBoost}% extra points</strong>
                    </p>
                  ) : (
                    <p className="text-sm text-[#6D4C41] font-medium">
                      Upgrade membership to earn <strong>bonus points</strong> on every order
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 font-medium">
                  Membership bonuses currently unavailable
                </p>
              )}
            </div>
          </div>

          {/* Additional Info Card */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-[#3E2723] mb-2">About Points</p>
                <ul className="text-sm text-[#6D4C41] space-y-1">
                  <li>• Minimum {remoteLoyaltyConfig.minRedeemablePoints} points required to redeem rewards</li>
                  <li>• {loyaltyAdmin.pointsToDiscountRatio} points = ₹1 discount</li>
                  {remoteLoyaltyConfig.expiryMonths ? (
                    <li>• Points expire after {remoteLoyaltyConfig.expiryMonths} months of inactivity</li>
                  ) : (
                    <li>• Points never expire</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="bg-gradient-to-r from-[#8B5A2B]/10 to-[#C8A47A]/10 border-2 border-[#C8A47A]/30 rounded-2xl p-6 mt-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-[#8B5A2B] rounded-xl flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-[#3E2723] mb-2 text-lg">
                Automatic Offers Applied
              </p>
              <p className="text-sm text-[#6D4C41] leading-relaxed">
                All available offers and discounts are automatically applied during checkout based on admin-defined rules. 
                Keep earning points with every order to unlock more exclusive rewards! Your points never expire.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}