import { useState } from 'react';
import { Trash2, Plus, Minus, ShoppingBag, CreditCard, Smartphone, Wallet, ArrowLeft, Loader2 } from 'lucide-react';
import type { CartItem, Order } from '@/client/app/App';
import { MenuItemImage } from '@/client/app/components/MenuItemImage';
import TopAppBar from '@/client/app/components/TopAppBar';

interface KioskCartProps {
  cart: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onCheckout: (order: Order) => void;
  onBackToMenu: () => void;
}

export default function KioskCart({ cart, onUpdateQuantity, onRemoveItem, onCheckout, onBackToMenu }: KioskCartProps) {
  const [selectedPayment, setSelectedPayment] = useState<'upi' | 'card' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState<string | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.05; // 5% GST
  const total = subtotal + tax;

  const handlePayment = () => {
    if (!selectedPayment) return;
    if (selectedPayment === 'upi' && !upiId.trim()) {
      setUpiError('UPI ID is required.');
      return;
    }

    setIsProcessing(true);

    // Daily sequential kiosk order number
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const storageKey = 'kiosk_order_counter';
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    let counter = 1;
    if (stored.date === today) {
      counter = (stored.count || 0) + 1;
    }
    localStorage.setItem(storageKey, JSON.stringify({ date: today, count: counter }));
    const orderId = `KIOSK-${String(counter).padStart(3, '0')}`;

    // Simulate payment processing
    setTimeout(() => {
      const order: Order = {
        id: orderId,
        items: cart,
        subtotal,
        tax,
        total,
        status: 'preparing',
        type: 'takeaway', // Kiosk orders are always counter pickup
        date: new Date().toISOString(),
        customerName: 'Kiosk Guest',
      };

      setIsProcessing(false);
      onCheckout(order);
    }, 2000);
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
        <div className="px-3 sm:px-5 pt-3 sm:pt-5">
          <TopAppBar
            title="Your Cart"
            centerSlot={
              <div className="hidden md:flex items-center gap-2">
                <span className="rounded-full border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1 text-[11px] font-semibold text-[#6D4C41]">
                  {cart.length} item{cart.length !== 1 ? 's' : ''}
                </span>
                <span className="rounded-full border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1 text-[11px] font-semibold text-[#6D4C41]">
                  Counter Pickup
                </span>
              </div>
            }
            rightSlot={
              <button
                onClick={onBackToMenu}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1.5 text-[11px] font-semibold text-[#3E2723] hover:border-[#C8A47A] hover:text-[#8B5A2B] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Menu
              </button>
            }
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 bg-[#FAF0E4] rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-[#C8A47A]" />
          </div>
          <h2 className="text-xl font-bold text-[#3E2723] mb-2">
            Your cart is empty
          </h2>
          <p className="text-gray-500 text-sm mb-6 text-center">Add some delicious items from the menu</p>
          <button
            onClick={onBackToMenu}
            className="px-8 py-3 bg-gradient-to-r from-[#8B5A2B] to-[#C8A47A] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all active:scale-95"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="px-3 sm:px-5 pt-3 sm:pt-5">
        <TopAppBar
          title="Your Cart"
          centerSlot={
            <div className="hidden md:flex items-center gap-2">
              <span className="rounded-full border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1 text-[11px] font-semibold text-[#6D4C41]">
                {cart.length} item{cart.length !== 1 ? 's' : ''}
              </span>
              <span className="rounded-full border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1 text-[11px] font-semibold text-[#6D4C41]">
                Counter Pickup
              </span>
            </div>
          }
          rightSlot={
            <button
              onClick={onBackToMenu}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1.5 text-[11px] font-semibold text-[#3E2723] hover:border-[#C8A47A] hover:text-[#8B5A2B] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Menu
            </button>
          }
        />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-5 pb-8 sm:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)] gap-4 lg:gap-5 items-start">
          <div className="space-y-4">
            {cart.map((item) => (
              <div key={item.id} className="min-h-[240px] overflow-hidden rounded-2xl border border-[#E8D5B5] bg-white shadow-sm md:grid md:grid-cols-[minmax(190px,220px)_minmax(0,1fr)]">
                <div className="relative h-52 md:h-full bg-[#FAF0E4]">
                  <MenuItemImage src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  <div className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.isVeg ? 'border-green-200 bg-green-600 text-white' : 'border-red-200 bg-red-600 text-white'}`}>
                    <span className="w-2 h-2 rounded-full bg-white" />
                    {item.isVeg ? 'Veg' : 'Non-Veg'}
                  </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-lg sm:text-xl font-bold text-[#3E2723]">{item.name}</h3>
                      <p className="text-xs sm:text-sm text-[#6D4C41]">Item details and quantity controls below</p>
                    </div>
                    <button onClick={() => onRemoveItem(item.id)} className="shrink-0 rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="space-y-2">
                      {item.spiceLevel && <p className="text-xs text-gray-500 capitalize">{item.spiceLevel} spice</p>}
                      {item.addons && item.addons.length > 0 && <p className="text-xs text-[#8B5A2B] line-clamp-1">{item.addons.join(', ')}</p>}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#6D4C41]">
                        <span className="rounded-full border border-[#E8D5B5] bg-[#FAF0E4] px-3 py-1">₹{item.price.toFixed(2)} each</span>
                        <span className="rounded-full border border-[#E8D5B5] bg-[#FAF0E4] px-3 py-1">Line total ₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="flex items-center gap-1.5 rounded-xl border border-[#E8D5B5] bg-[#FAF0E4] p-1">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8B5A2B] transition-colors hover:bg-[#E8D5B5]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-bold text-[#3E2723]">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8B5A2B] transition-colors hover:bg-[#E8D5B5]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-lg font-black text-[#8B5A2B]">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-4">
            <div className="rounded-2xl border border-[#E8D5B5] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-[#3E2723]">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#6D4C41]">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#6D4C41]">
                  <span>GST (5%)</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E8D5B5] pt-2 font-bold text-[#3E2723]">
                  <span>Total</span>
                  <span className="text-[#8B5A2B]">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8D5B5] bg-[#FAF0E4] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8B5A2B]">
                  <ShoppingBag className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#3E2723]">Counter Pickup</p>
                  <p className="text-[11px] text-[#8B5A2B]/70">Your order will be ready for pickup at the counter</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8D5B5] bg-white p-5 sm:p-6 shadow-md">
              <h3 className="mb-4 text-base sm:text-lg font-bold text-[#3E2723]">Payment Method</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => { setSelectedPayment('upi'); setUpiError(null); }}
                  className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 sm:p-5 transition-all ${
                    selectedPayment === 'upi'
                      ? 'border-[#8B5A2B] bg-[#FAF0E4]'
                      : 'border-[#E8D5B5] hover:border-[#C8A47A] hover:bg-[#FAF0E4]/50'
                  }`}
                >
                  <Smartphone className="w-6 h-6 text-[#8B5A2B]" />
                  <span className="text-sm font-semibold text-[#3E2723]">UPI</span>
                </button>
                <button
                  onClick={() => { setSelectedPayment('card'); setUpiError(null); }}
                  className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 sm:p-5 transition-all ${
                    selectedPayment === 'card'
                      ? 'border-[#8B5A2B] bg-[#FAF0E4]'
                      : 'border-[#E8D5B5] hover:border-[#C8A47A] hover:bg-[#FAF0E4]/50'
                  }`}
                >
                  <CreditCard className="w-6 h-6 text-[#8B5A2B]" />
                  <span className="text-sm font-semibold text-[#3E2723]">Card</span>
                </button>
              </div>

              {selectedPayment === 'upi' && (
                <div className="mt-5">
                  <label className="mb-1 block text-sm font-medium text-[#3E2723]">UPI ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => { setUpiId(e.target.value); setUpiError(null); }}
                    placeholder="yourname@upi"
                    className="w-full rounded-xl border border-[#E8D5B5] px-4 py-3 text-sm text-[#3E2723] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                  />
                  {upiError && <p className="text-red-500 text-xs mt-1">{upiError}</p>}
                </div>
              )}

              {selectedPayment === 'card' && (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#3E2723]">Card Number</label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      className="w-full rounded-xl border border-[#E8D5B5] px-4 py-3 text-sm text-[#3E2723] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#3E2723]">Expiry</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        className="w-full rounded-xl border border-[#E8D5B5] px-4 py-3 text-sm text-[#3E2723] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[#3E2723]">CVV</label>
                      <input
                        type="text"
                        placeholder="123"
                        className="w-full rounded-xl border border-[#E8D5B5] px-4 py-3 text-sm text-[#3E2723] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8A47A]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handlePayment}
              disabled={!selectedPayment || isProcessing}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
                selectedPayment && !isProcessing
                  ? 'bg-gradient-to-r from-[#8B5A2B] to-[#C8A47A] text-white hover:shadow-lg active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  Pay ₹{total.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
