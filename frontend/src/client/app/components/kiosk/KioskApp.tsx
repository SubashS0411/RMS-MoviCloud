import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KioskMenu from '@/client/app/components/kiosk/KioskMenu';
import KioskCart from '@/client/app/components/kiosk/KioskCart';
import KioskConfirmation from '@/client/app/components/kiosk/KioskConfirmation';
import { createOrder } from '@/client/api/orders';
import type { CartItem, Order } from '@/client/app/App';

type KioskStep = 'menu' | 'cart' | 'confirmation';

export default function KioskApp() {
  const navigate = useNavigate();
  const [step, setStep] = useState<KioskStep>('menu');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const addToCart = (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + (item.quantity || 1) } : c,
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });
  };

  const updateCartItem = (id: string, quantity: number) => {
    setCart((prev) =>
      quantity === 0
        ? prev.filter((item) => item.id !== id)
        : prev.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCheckout = (order: Order) => {
    setCompletedOrder(order);

    // Send order to backend with source: "kiosk"
    createOrder(
      { ...order, customerName: 'Kiosk Guest' } as Order,
      undefined, // no userId for kiosk
      'kiosk',   // source identifier
    ).catch((err) => {
      console.error('[KioskApp] failed to save kiosk order:', err);
    });

    setCart([]);
    setStep('confirmation');
  };

  const handleNewOrder = () => {
    setCart([]);
    setCompletedOrder(null);
    setStep('menu');
  };

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen">
      {step === 'menu' && (
        <KioskMenu
          onAddToCart={addToCart}
          onGoToCart={() => setStep('cart')}
          cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
          cart={cart}
          onUpdateQuantity={updateCartItem}
          onRemoveItem={removeFromCart}
        />
      )}
      {step === 'cart' && (
        <KioskCart
          cart={cart}
          onUpdateQuantity={updateCartItem}
          onRemoveItem={removeFromCart}
          onCheckout={handleCheckout}
          onBackToMenu={() => setStep('menu')}
        />
      )}
      {step === 'confirmation' && completedOrder && (
        <KioskConfirmation
          order={completedOrder}
          onNewOrder={handleNewOrder}
          onGoHome={handleGoHome}
        />
      )}
    </div>
  );
}
