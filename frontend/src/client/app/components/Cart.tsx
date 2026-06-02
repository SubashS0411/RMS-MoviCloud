import { useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, Minus, ShoppingBag, CreditCard, Smartphone, Wallet, CheckCircle, Download, Award, Users as UsersIcon, MapPin, Loader2, FileText, ChevronDown, ChevronUp, Clock, Receipt, ArrowRight, Sparkles } from 'lucide-react';
import { MenuItemImage } from '@/client/app/components/MenuItemImage';
import type { CartItem, Order, User } from '@/client/app/App';
import { useLoyalty } from '@/client/app/context/LoyaltyContext';
import type { Offer } from '@/client/app/data/offersData';
import { getEligibleOffers } from '@/client/app/data/offersData';
import { fetchEligibleOffers } from '@/client/api/offers';
import { fetchTables, fetchActiveReservation } from '@/client/api/reservations';
import type { Table } from '@/client/api/reservations';
import { fetchInvoices } from '@/client/api/orders';
import type { ClientInvoice } from '@/client/api/orders';

interface CartProps {
  cart: CartItem[];
  user?: User;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: (order: Order) => void;
}

export default function Cart({ cart, user, onUpdateQuantity, onRemoveItem, onCheckout }: CartProps) {
  const loyalty = useLoyalty();
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | null>(null);
  const [tableNumber, setTableNumber] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<'upi' | 'card' | 'cash' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState<string | null>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);
  const [appliedOfferId, setAppliedOfferId] = useState<string | null>(null);

  // Previous orders / bills history
  const [invoiceHistory, setInvoiceHistory] = useState<ClientInvoice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Real tables fetched from the backend
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  // tableId of the current user's active / upcoming reservation (if any)
  const [reservedTableId, setReservedTableId] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [eligibleOffers, setEligibleOffers] = useState<Offer[]>([]);

  // Fetch real tables (+ user's reservation) when dine-in is chosen
  useEffect(() => {
    if (orderType !== 'dine-in') return;
    let cancelled = false;
    setTablesLoading(true);

    const loadTables = fetchTables().then((list) => {
      if (!cancelled) setTables(list);
    }).catch(() => {});

    const loadReservation = user?.email
      ? fetchActiveReservation(user.email)
          .then((res) => {
            if (!cancelled && res.active && res.reservation) {
              const tid = res.reservation.tableNumber; // tableId stored here
              setReservedTableId(String(tid));
              // Auto-select if nothing chosen yet
              setTableNumber((prev) => prev || String(tid));
            }
          })
          .catch(() => {})
      : Promise.resolve();

    Promise.all([loadTables, loadReservation]).finally(() => {
      if (!cancelled) setTablesLoading(false);
    });

    return () => { cancelled = true; };
  }, [orderType, user?.email]);

  useEffect(() => {
    let cancelled = false;
    const loyaltyPoints = user ? loyalty.balancePoints : 0;
    fetchEligibleOffers({ subtotal, loyaltyPoints })
      .then((offers) => {
        if (!cancelled) setEligibleOffers(offers);
      })
      .catch(() => {
        if (!cancelled) setEligibleOffers(getEligibleOffers(subtotal, loyaltyPoints));
      });
    return () => {
      cancelled = true;
    };
  }, [loyalty.balancePoints, subtotal, user]);

  // Load invoice history whenever the user is known
  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    setLoadingHistory(true);
    fetchInvoices(user.email)
      .then((inv) => { if (!cancelled) setInvoiceHistory(inv); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [user?.email]);

  const appliedOffer: Offer | null = useMemo(() => {
    if (!appliedOfferId) return null;
    return eligibleOffers.find((o) => o.id === appliedOfferId) ?? null;
  }, [appliedOfferId, eligibleOffers]);

  useEffect(() => {
    if (appliedOfferId && !appliedOffer) {
      setAppliedOfferId(null);
    }
  }, [appliedOffer, appliedOfferId]);

  const offerDiscount = useMemo(() => {
    if (!appliedOffer) return 0;
    if (subtotal <= 0) return 0;

    const computed =
      appliedOffer.type === 'PERCENT'
        ? Math.floor((subtotal * appliedOffer.value) / 100)
        : appliedOffer.value;

    return Math.min(subtotal, Math.max(0, computed));
  }, [appliedOffer, subtotal]);

  const subtotalAfterOffer = Math.max(0, subtotal - offerDiscount);

  const loyaltyDiscount = useMemo(() => {
    if (!loyalty.config.loyaltyEnabled) return 0;
    if (!useLoyaltyPoints) return 0;
    if (!user) return 0;
    if (!loyalty.canRedeem) return 0;
    if (loyaltyPointsToUse < loyalty.config.minRedeemablePoints) return 0;
    if (loyaltyPointsToUse > loyalty.maxRedeemablePoints) return 0;

    const discount = loyalty.pointsToRupeeDiscount(loyaltyPointsToUse);
    return Math.min(subtotalAfterOffer, Math.max(0, discount));
  }, [loyalty, loyaltyPointsToUse, subtotalAfterOffer, useLoyaltyPoints, user]);

  const discountedSubtotal = Math.max(0, subtotalAfterOffer - loyaltyDiscount);
  const tax = discountedSubtotal * 0.05; // 5% GST (applied after loyalty discount)
  const total = discountedSubtotal + tax;

  const handlePayment = () => {
    if (!orderType || !selectedPayment) return;
    if (selectedPayment === 'upi' && !upiId.trim()) {
      setUpiError('UPI ID is required.');
      return;
    }

    const orderId = pendingOrderId ?? `ORD-${Date.now()}`;
    setPendingOrderId(orderId);

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);

      if (useLoyaltyPoints && loyaltyDiscount > 0) {
        loyalty.redeemPoints({ orderId, points: loyaltyPointsToUse });
      }

      const earned = loyalty.earnForPayment({
        orderId,
        subtotal: discountedSubtotal,
        date: new Date().toISOString(),
      });
      setEarnedPoints(earned.pointsAwarded);
      
      const order: Order = {
        id: orderId,
        items: cart,
        subtotal: discountedSubtotal,
        tax,
        loyaltyDiscount,
        loyaltyPointsRedeemed: useLoyaltyPoints ? loyaltyPointsToUse : 0,
        total,
        status: 'preparing',
        type: orderType,
        date: new Date().toISOString(),
        deliveryAddress: user?.address || '',
        tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
        customerName: user?.name || 'Guest',
      };
      
      setTimeout(() => {
        onCheckout(order);
      }, 2000);
    }, 2000);
  };

  // ── Previous Orders & Bills section (reused in both empty and filled views) ──
  const previousOrdersSection = user ? (
    <div className="w-full">
      <button
        onClick={() => setShowHistory((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white border border-[#E8DED0] rounded-2xl shadow-sm hover:shadow-md transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center ring-1 ring-amber-100">
            <Receipt className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm sm:text-base">Previous Orders &amp; Bills</p>
            <p className="text-xs sm:text-sm text-gray-500">
              {loadingHistory ? 'Loading…' : `${invoiceHistory.length} order${invoiceHistory.length !== 1 ? 's' : ''} found`}
            </p>
          </div>
        </div>
        {showHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {showHistory && (
        <div className="mt-3 border border-[#E8DED0] rounded-2xl overflow-hidden bg-white shadow-sm">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading your orders…</span>
            </div>
          ) : invoiceHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No past orders yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {invoiceHistory.map((inv) => {
                const isExpanded = expandedBillId === inv.id;
                const date = inv.createdAt ? new Date(inv.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
                return (
                  <li key={inv.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            {inv.invoiceNumber || inv.orderId?.slice(-8).toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {inv.status}
                          </span>
                          <span className="text-[10px] text-gray-400 capitalize">{inv.orderType || 'order'}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{date}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">₹{Number(inv.grandTotal).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{inv.items?.length ?? 0} item{(inv.items?.length ?? 0) !== 1 ? 's' : ''}</p>
                      </div>
                      <button
                        onClick={() => setExpandedBillId(isExpanded ? null : inv.id)}
                        className="ml-2 shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {isExpanded ? 'Close' : 'Bill'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="bg-amber-50/40 border-t border-amber-100 px-5 py-4 text-sm">
                        <div className="flex justify-between items-center mb-3">
                          <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                            <Receipt className="w-4 h-4 text-amber-600" />
                            Invoice {inv.invoiceNumber}
                          </p>
                          {inv.tableNumber && (
                            <span className="text-xs text-gray-500">Table {inv.tableNumber}</span>
                          )}
                        </div>
                        <div className="space-y-1 mb-3">
                          {(inv.items || []).map((item, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-700">
                              <span>{item.name} × {item.quantity}</span>
                              <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-amber-200 pt-2 space-y-1">
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Subtotal</span><span>₹{Number(inv.subtotal).toFixed(2)}</span>
                          </div>
                          {inv.taxAmount > 0 && (
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>GST ({inv.taxPercent}%)</span><span>₹{Number(inv.taxAmount).toFixed(2)}</span>
                            </div>
                          )}
                          {inv.discountAmount > 0 && (
                            <div className="flex justify-between text-xs text-green-600">
                              <span>Discount</span><span>−₹{Number(inv.discountAmount).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-gray-900 border-t border-amber-200 pt-1 mt-1">
                            <span>Total Paid</span><span>₹{Number(inv.grandTotal).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="capitalize">{inv.paymentMethod || 'online'}</span>
                          <span>·</span>
                          <span>{date}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  ) : null;

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
          <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6">
              <CheckCircle className="w-9 h-9 sm:w-12 sm:h-12 text-green-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-4">
              Your payment of ₹{total.toFixed(2)} has been received
            </p>
            {loyalty.config.loyaltyEnabled && earnedPoints > 0 && (
              <p className="text-gray-600 mb-4">
                🎉 You earned {earnedPoints} loyalty points for this order!
              </p>
            )}
            <div className="animate-pulse text-gray-500 text-sm">
              Redirecting to order tracking...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F5F0E8] via-[#FAF7F2] to-white py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8B5A2B]">Basket / Bills / History</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#2D1B10]">A calmer cart experience</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E8DED0] bg-white px-4 py-2 text-sm text-[#6D4C41] shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8B5A2B]" />
              Empty basket, full control
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 lg:gap-8 items-start">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#E8DED0] bg-white shadow-[0_24px_80px_-24px_rgba(62,39,35,0.22)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,164,122,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(62,39,35,0.08),transparent_36%)]" />
              <div className="relative z-10 p-6 sm:p-10 lg:p-12">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F8F1E7] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#8B5A2B] border border-[#C8A47A]/40">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Cart Ready
                </div>

                <div className="mt-7 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 md:gap-6 items-center">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-[1.75rem] bg-[#3E2723] text-[#C8A47A] flex items-center justify-center shadow-lg shadow-[#3E2723]/10 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
                    <ShoppingBag className="w-10 h-10 sm:w-12 sm:h-12 relative z-10" />
                  </div>

                  <div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#2D1B10] leading-tight max-w-xl">
                      Your cart is empty, but the kitchen is not.
                    </h2>
                    <p className="mt-3 text-base sm:text-lg text-[#6D4C41] max-w-2xl leading-relaxed">
                      Build a fresh order from the menu, or jump back into your bill history and continue where you left off.
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={() => onNavigate('menu')}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#8B5A2B] px-6 py-3.5 text-white font-semibold shadow-lg hover:bg-[#6D4C41] transition-all"
                  >
                    Browse Menu
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                  <button
                    onClick={() => onNavigate('tracking')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#C8A47A]/60 bg-white px-6 py-3.5 text-[#5D4037] font-semibold hover:bg-[#F8F1E7] transition-all"
                  >
                    Track Order
                  </button>
                  <button
                    onClick={() => onNavigate('reservation')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E8DED0] bg-[#FAF7F2] px-6 py-3.5 text-[#5D4037] font-semibold hover:bg-white transition-all"
                  >
                    Reserve Table
                  </button>
                </div>

                <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { title: 'Fast Checkout', desc: 'Cart, payment, and tracking stay one tap away.' },
                    { title: 'Saved Bills', desc: 'Revisit invoices without digging through the app.' },
                    { title: 'Menu Favorites', desc: 'Return to dishes you already know will work.' },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl border border-[#E8DED0] bg-[#FFFDF9] p-4">
                      <p className="font-semibold text-[#2D1B10]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#6D4C41] leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[2rem] border border-[#E8DED0] bg-white shadow-[0_20px_60px_-24px_rgba(62,39,35,0.18)] p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8B5A2B]">Order Memory</p>
                    <h3 className="text-xl font-bold text-[#2D1B10] mt-1">Recent activity</h3>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-[#F8F1E7] flex items-center justify-center border border-[#C8A47A]/30">
                    <Receipt className="w-5 h-5 text-[#8B5A2B]" />
                  </div>
                </div>

                {user ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-[#FAF7F2] border border-[#E8DED0] p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#8B5A2B] font-bold">Recent bills</p>
                        <p className="mt-2 text-2xl font-bold text-[#2D1B10]">{invoiceHistory.length}</p>
                      </div>
                      <div className="rounded-2xl bg-[#FAF7F2] border border-[#E8DED0] p-4">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#8B5A2B] font-bold">Last payment</p>
                        <p className="mt-2 text-2xl font-bold text-[#2D1B10]">
                          {invoiceHistory[0] ? `₹${Number(invoiceHistory[0].grandTotal).toFixed(0)}` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E8DED0] bg-[#FFFDF9] p-4">
                      {previousOrdersSection}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#E8DED0] bg-[#FFFDF9] p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B5A2B]">Signed out</p>
                    <h3 className="text-lg font-bold text-[#2D1B10] mt-1">Log in to see previous bills</h3>
                    <p className="text-sm text-[#6D4C41] mt-1">Previous orders and invoices appear once you sign in.</p>
                    <button
                      onClick={() => onNavigate('login')}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#3E2723] px-5 py-3 text-white font-semibold hover:bg-[#2D1B10] transition-all"
                    >
                      Sign In
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-[#E8DED0] bg-white shadow-[0_20px_60px_-24px_rgba(62,39,35,0.18)] p-5 sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8B5A2B]">Flow</p>
                <div className="mt-4 space-y-3">
                  {[
                    'Browse the menu and add what you want',
                    'Review cart and complete payment',
                    'Track preparation status after checkout',
                  ].map((step, index) => (
                    <div key={step} className="flex items-start gap-3 rounded-2xl bg-[#FAF7F2] border border-[#E8DED0] p-4">
                      <div className="w-8 h-8 rounded-full bg-[#3E2723] text-[#FAF7F2] flex items-center justify-center text-sm font-bold shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-sm text-[#4E342E] leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-8 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 sm:mb-6">
          <h1 className="!text-[24px] !font-semibold mb-1">Shopping Cart &amp; Checkout</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{cart.length} items in your cart</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)] gap-4 lg:gap-5 items-start">
          {/* Cart Items */}
          <div className="space-y-4">
            {/* Cart Items List */}
            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#E8D5B5] shadow-sm p-4 sm:p-5"
                >
                  <div className="flex items-start gap-4">
                    {/* Item Image */}
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#FAF0E4] flex-shrink-0 ring-1 ring-[#E8D5B5]">
                      <MenuItemImage
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-base sm:text-lg text-[#3E2723]">{item.name}</h3>
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                              item.isVeg
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                          </span>
                        </div>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </button>
                      </div>

                      {/* Customizations */}
                      {(item.spiceLevel || item.addons?.length || item.specialInstructions) && (
                        <div className="mb-3 text-xs sm:text-sm text-gray-600 space-y-1">
                          {item.spiceLevel && (
                            <p>
                              <span className="font-medium">Spice:</span> {item.spiceLevel}
                            </p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <p>
                              <span className="font-medium">Add-ons:</span>{' '}
                              {item.addons.join(', ')}
                            </p>
                          )}
                          {item.specialInstructions && (
                            <p>
                              <span className="font-medium">Note:</span>{' '}
                              {item.specialInstructions}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Quantity and Price */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 bg-[#FAF0E4] rounded-lg hover:bg-[#E8D5B5] transition-colors flex items-center justify-center"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-semibold w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 bg-[#FAF0E4] rounded-lg hover:bg-[#E8D5B5] transition-colors flex items-center justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-xs sm:text-sm text-gray-600">₹{item.price} each</p>
                          <p className="text-lg sm:text-xl font-bold text-[#8B5A2B]">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Type Selection */}
            <div className="bg-white rounded-2xl border border-[#E8D5B5] shadow-sm p-5">
              <h2 className="!text-[22px] !font-semibold text-[#3E2723] mb-3">Select Order Type</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setOrderType('dine-in'); setTableNumber(''); }}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    orderType === 'dine-in'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <p className="font-semibold">Dine-In</p>
                  <p className="text-sm text-gray-600 mt-1">Eat at restaurant</p>
                </button>
                <button
                  onClick={() => { setOrderType('takeaway'); setTableNumber(''); }}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    orderType === 'takeaway'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <p className="font-semibold">Takeaway</p>
                  <p className="text-sm text-gray-600 mt-1">Pick up later</p>
                </button>
              </div>

              {orderType === 'dine-in' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Your Table <span className="text-red-500">*</span>
                  </label>

                  {tablesLoading ? (
                    <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading tables…
                    </div>
                  ) : tables.length === 0 ? (
                    <input
                      type="text"
                      placeholder="Enter your table number"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
                    />
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                      {tables.map((t) => {
                        const status = (t.status ?? 'available').toLowerCase();
                        const isMyReservation = reservedTableId === t.tableId;
                        const isSelected = tableNumber === t.tableId;
                        const selectable = status === 'available' || isMyReservation;

                        let cardCls = 'relative flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 text-center text-xs transition-all ';
                        if (!selectable) {
                          cardCls += 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60';
                        } else if (isSelected) {
                          cardCls += 'border-black bg-gray-900 text-white shadow-md cursor-pointer';
                        } else if (isMyReservation) {
                          cardCls += 'border-blue-500 bg-blue-50 text-blue-800 cursor-pointer hover:bg-blue-100';
                        } else {
                          cardCls += 'border-green-400 bg-green-50 text-green-800 cursor-pointer hover:bg-green-100';
                        }

                        const statusLabel =
                          isMyReservation ? 'Your Reservation'
                          : status === 'available' ? 'Available'
                          : status === 'cleaning' ? 'Cleaning'
                          : status === 'occupied' || status === 'eating' ? 'Occupied'
                          : 'Unavailable';

                        return (
                          <button
                            key={t.tableId}
                            type="button"
                            disabled={!selectable}
                            onClick={() => selectable && setTableNumber(t.tableId)}
                            className={cardCls}
                            title={`${t.tableName} — ${t.location}${t.segment ? ` / ${t.segment}` : ''}`}
                          >
                            {isMyReservation && (
                              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border border-white" />
                            )}
                            {isSelected && (
                              <CheckCircle className="absolute -top-1.5 -right-1.5 w-4 h-4 text-white bg-black rounded-full" />
                            )}
                            <span className="font-bold text-sm leading-tight">{t.tableName}</span>
                            <span className="flex items-center gap-0.5 text-[10px] opacity-75">
                              <UsersIcon className="w-2.5 h-2.5" />{t.capacity}
                            </span>
                            {t.location && (
                              <span className="flex items-center gap-0.5 text-[10px] opacity-75 truncate max-w-full">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{t.location}</span>
                              </span>
                            )}
                            <span className="text-[9px] font-medium mt-0.5">{statusLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {!tablesLoading && tableNumber && (
                    <p className="mt-2 text-xs text-gray-500">
                      Selected:{' '}
                      <span className="font-semibold text-gray-800">
                        {tables.find((t) => t.tableId === tableNumber)?.tableName ?? tableNumber}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Billing Summary - Sticky Sidebar */}
          <div>
            <div className="loyalty-card membership-gradient p-5 sm:p-6 sticky top-20">
              <div className="loyalty-card-decor-1"></div>
              <div className="loyalty-card-decor-2"></div>

              <div className="relative z-10">
                <h2 className="!text-[22px] !font-semibold mb-6 text-[#FAF7F2]">
                  Bill Summary
                </h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-[#FAF7F2]/80">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#FAF7F2]">₹{subtotal.toFixed(2)}</span>
                  </div>

                  {/* Eligible Offers */}
                  {eligibleOffers.length > 0 && (
                    <div className="loyalty-panel p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-sm font-bold text-[#FAF7F2]">Eligible Offers</p>
                        <span className="loyalty-badge">Offers</span>
                      </div>
                      <div className="space-y-2">
                        {eligibleOffers.map((offer) => {
                          const isApplied = appliedOfferId === offer.id;
                          const disabled = !!appliedOfferId && !isApplied;
                          return (
                            <div
                              key={offer.id}
                              className={isApplied ? 'loyalty-row loyalty-row-applied' : 'loyalty-row'}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold text-[#FAF7F2]/90 truncate">{offer.title}</p>
                                  {isApplied && <span className="loyalty-badge-solid">Applied</span>}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setAppliedOfferId((prev) => (prev === offer.id ? null : offer.id))}
                                disabled={disabled}
                                className={`${isApplied ? 'loyalty-badge-solid' : 'loyalty-badge'} transition-all ${
                                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110'
                                }`}
                              >
                                {isApplied ? 'Remove' : 'Apply'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {offerDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm text-[#FAF7F2]/80">
                      <span>Offer Discount</span>
                      <span className="font-semibold text-[#C8A47A] tabular-nums">-₹{offerDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Loyalty Points Redemption */}
                  <div className="loyalty-panel p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#FAF7F2] select-none">
                        <input
                          type="checkbox"
                          checked={useLoyaltyPoints}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setUseLoyaltyPoints(next);
                            if (!next) setLoyaltyPointsToUse(0);
                            if (next && loyaltyPointsToUse < loyalty.config.minRedeemablePoints) {
                              setLoyaltyPointsToUse(loyalty.config.minRedeemablePoints);
                            }
                          }}
                          disabled={!user || !loyalty.config.loyaltyEnabled || !loyalty.canRedeem}
                          className="loyalty-checkbox"
                        />
                        <Award className="w-4 h-4 text-[#C8A47A]" />
                        Use Loyalty Points
                      </label>

                      <div className="text-right">
                        <p className="text-xs text-[#FAF7F2]/70">Available</p>
                        <span className="loyalty-badge mt-1">{user ? loyalty.balancePoints : 0} pts</span>
                      </div>
                    </div>

                    {!loyalty.config.loyaltyEnabled && (
                      <p className="text-xs text-[#FAF7F2]/70 mt-2">Loyalty program is currently disabled.</p>
                    )}
                    {loyalty.config.loyaltyEnabled && user && !loyalty.canRedeem && (
                      <p className="text-xs text-[#FAF7F2]/70 mt-2">
                        Minimum {loyalty.config.minRedeemablePoints} points required to redeem.
                      </p>
                    )}

                    {useLoyaltyPoints && user && loyalty.config.loyaltyEnabled && loyalty.canRedeem && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-[#FAF7F2]/75 mb-2">
                          <span>Select points to use</span>
                          <span>
                            {loyaltyPointsToUse} pts (₹{Math.min(subtotalAfterOffer, loyalty.pointsToRupeeDiscount(loyaltyPointsToUse)).toFixed(0)} off)
                          </span>
                        </div>
                        <input
                          type="range"
                          min={loyalty.config.minRedeemablePoints}
                          max={loyalty.maxRedeemablePoints}
                          step={loyalty.config.pointsPerRupeeDiscount}
                          value={Math.min(loyaltyPointsToUse, loyalty.maxRedeemablePoints)}
                          onChange={(e) => setLoyaltyPointsToUse(Number(e.target.value))}
                          className="w-full accent-[#C8A47A]"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-[#FAF7F2]/60">{loyalty.config.minRedeemablePoints} pts</span>
                          <span className="text-xs text-[#FAF7F2]/60">{loyalty.maxRedeemablePoints} pts</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {loyaltyDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm text-[#FAF7F2]/80">
                      <span>Loyalty Discount</span>
                      <span className="font-semibold text-[#C8A47A] tabular-nums">-₹{loyaltyDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-[#FAF7F2]/80">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-[#FAF7F2] tabular-nums">₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-[#C8A47A]/20">
                    <div className="flex justify-between items-end">
                      <span className="text-base font-semibold text-[#FAF7F2]">Total Amount</span>
                      <span className="text-2xl font-bold text-[#C8A47A] tabular-nums">₹{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {orderType && (
                  <div className="mb-4 p-3 loyalty-panel">
                    <p className="text-sm text-[#FAF7F2]/70">Order Type</p>
                    <p className="font-semibold text-[#FAF7F2] capitalize">{orderType.replace('-', ' ')}</p>
                  </div>
                )}

                {orderType && (
                  <div className="mb-4 p-3 loyalty-panel">
                    <p className="text-sm text-[#FAF7F2]/70 mb-2">Payment Method</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => { setSelectedPayment('upi'); setUpiError(null); }}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs font-semibold transition-colors ${
                          selectedPayment === 'upi'
                            ? 'border-[#C8A47A] bg-[#FAF7F2] text-[#3E2723]'
                            : 'border-[#C8A47A]/40 text-[#FAF7F2] hover:border-[#C8A47A]'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        UPI
                      </button>
                      <button
                        onClick={() => { setSelectedPayment('card'); setUpiError(null); }}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs font-semibold transition-colors ${
                          selectedPayment === 'card'
                            ? 'border-[#C8A47A] bg-[#FAF7F2] text-[#3E2723]'
                            : 'border-[#C8A47A]/40 text-[#FAF7F2] hover:border-[#C8A47A]'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        Card
                      </button>
                      <button
                        onClick={() => { setSelectedPayment('cash'); setUpiError(null); }}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs font-semibold transition-colors ${
                          selectedPayment === 'cash'
                            ? 'border-[#C8A47A] bg-[#FAF7F2] text-[#3E2723]'
                            : 'border-[#C8A47A]/40 text-[#FAF7F2] hover:border-[#C8A47A]'
                        }`}
                      >
                        <Wallet className="w-4 h-4" />
                        Cash
                      </button>
                    </div>

                    {selectedPayment === 'upi' && (
                      <div className="mt-3 space-y-1">
                        <label className="block text-xs font-semibold text-[#FAF7F2]/85">UPI ID</label>
                        <input
                          type="text"
                          placeholder="yourname@upi"
                          value={upiId}
                          onChange={(e) => {
                            setUpiId(e.target.value);
                            if (upiError) setUpiError(null);
                          }}
                          className="w-full rounded-lg border border-[#C8A47A]/40 bg-[#FAF7F2] px-3 py-2 text-sm text-[#3E2723] placeholder:text-[#8B5A2B]/60 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                        />
                        {upiError && <p className="text-xs text-[#FCA5A5]">{upiError}</p>}
                      </div>
                    )}

                    {selectedPayment === 'card' && (
                      <div className="mt-3 space-y-2">
                        <div>
                          <label className="block text-xs font-semibold text-[#FAF7F2]/85 mb-1">Card Number</label>
                          <input
                            type="text"
                            placeholder="1234 5678 9012 3456"
                            className="w-full rounded-lg border border-[#C8A47A]/40 bg-[#FAF7F2] px-3 py-2 text-sm text-[#3E2723] placeholder:text-[#8B5A2B]/60 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-[#FAF7F2]/85 mb-1">Expiry</label>
                            <input
                              type="text"
                              placeholder="MM/YY"
                              className="w-full rounded-lg border border-[#C8A47A]/40 bg-[#FAF7F2] px-3 py-2 text-sm text-[#3E2723] placeholder:text-[#8B5A2B]/60 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#FAF7F2]/85 mb-1">CVV</label>
                            <input
                              type="text"
                              placeholder="123"
                              className="w-full rounded-lg border border-[#C8A47A]/40 bg-[#FAF7F2] px-3 py-2 text-sm text-[#3E2723] placeholder:text-[#8B5A2B]/60 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handlePayment}
                  disabled={
                    !orderType ||
                    !selectedPayment ||
                    isProcessing ||
                    (selectedPayment === 'upi' && !upiId.trim()) ||
                    (orderType === 'dine-in' && !tableNumber.trim())
                  }
                  className="w-full bg-[#C8A47A] text-[#2D1B10] py-3 rounded-lg font-semibold hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed mb-3"
                >
                  {isProcessing ? 'Processing...' : `Complete Payment - ₹${total.toFixed(2)}`}
                </button>

                <button className="w-full flex items-center justify-center gap-2 text-[#FAF7F2]/80 py-2 text-sm hover:text-[#FAF7F2]">
                  <Download className="w-4 h-4" />
                  Download Invoice
                </button>

                <div className="mt-6 p-4 loyalty-panel">
                  <p className="text-sm text-[#FAF7F2]/85">
                    <span className="loyalty-badge-solid mr-2">Free Delivery</span>
                    on orders above ₹500
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
        {/* Previous Orders & Bills */}
        {previousOrdersSection}
      </div>
    </div>
  );
}