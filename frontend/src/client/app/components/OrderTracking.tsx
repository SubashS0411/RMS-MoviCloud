import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, ChefHat, CheckCheck } from 'lucide-react';
import type { Order } from '@/client/app/App';
import { useLoyalty } from '@/client/app/context/LoyaltyContext';
import { apiRequest } from '@/client/api/client';

interface OrderTrackingProps {
  order: Order | null;
}

export default function OrderTracking({ order }: OrderTrackingProps) {
  const loyalty = useLoyalty();
  const [currentStatus, setCurrentStatus] = useState<Order['status']>(order?.status || 'preparing');
  const earnedRef = useRef(false);

  // Poll the real order status from the backend every 5 seconds
  useEffect(() => {
    if (!order?.id) return;

    const TERMINAL_STATUSES: Order['status'][] = ['served', 'completed'];

    const poll = async () => {
      try {
        const res = await apiRequest<{ status: Order['status'] }>(`/orders/${order.id}`);
        if (res?.status) {
          setCurrentStatus(res.status);
        }
      } catch {
        // silently keep last known status
      }
    };

    // fetch immediately, then every 5 s
    poll();
    const interval = setInterval(() => {
      // stop polling once the order is in a terminal state
      if (TERMINAL_STATUSES.includes(currentStatus)) {
        clearInterval(interval);
        return;
      }
      poll();
    }, 5000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  useEffect(() => {
    if (!order) return;
    if (currentStatus !== 'served' && currentStatus !== 'completed') return;
    if (earnedRef.current) return; // only award points once
    earnedRef.current = true;

    const itemsSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const effectiveSubtotal =
      typeof order.subtotal === 'number'
        ? order.subtotal
        : Math.max(0, itemsSubtotal - (order.loyaltyDiscount ?? 0));

    loyalty.earnForPayment({
      orderId: order.id,
      subtotal: effectiveSubtotal,
      date: new Date().toISOString(),
    });
  }, [currentStatus, loyalty, order]);

  // Guard: If no order exists, show a message (placed after hooks to respect rules-of-hooks)
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-6">
        <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">No Order Found</h2>
          <p className="text-gray-600 mb-6">
            Please place an order from the menu first.
          </p>
        </div>
      </div>
    );
  }

  const steps = [
    {
      id: 'preparing',
      label: 'Preparing',
      icon: ChefHat,
      description: 'Your order is being prepared by our chefs'
    },
    {
      id: 'ready',
      label: 'Ready',
      icon: CheckCheck,
      description: 'Your order is ready for pickup/serving'
    },
    {
      id: 'served',
      label: 'Served',
      icon: CheckCircle,
      description: 'Order completed - Enjoy your meal!'
    }
  ];

  const getStepStatus = (stepId: string) => {
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    // 'completed' is beyond 'served' — treat it as past-the-end
    const resolvedStatus = currentStatus === 'completed' ? 'served' : currentStatus;
    const currentIndex = steps.findIndex((s) => s.id === resolvedStatus);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return currentStatus === 'completed' ? 'completed' : 'active';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="order-tracking-title mb-1">Track Your Order</h1>
          <p className="text-gray-600">Order #{order.id}</p>
        </div>

        {/* Order Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5 transition-all duration-200 hover:shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Order Type</p>
              <p className="font-semibold capitalize">{order.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Order Time</p>
              <p className="font-semibold">
                {new Date(order.date).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="font-semibold">₹{order.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 transition-all duration-200 hover:shadow-md">
          <h2 className="order-status mb-5">Order Status</h2>

          <div className="space-y-5">
            {steps.map((step, index) => {
              const status = getStepStatus(step.id);
              const Icon = step.icon;

              return (
                <div key={step.id} className="relative rounded-xl transition-all duration-200 hover:bg-gray-50/70">
                  <div className="flex items-start gap-3 p-2">
                    {/* Icon Circle */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        status === 'completed'
                          ? 'bg-green-600'
                          : status === 'active'
                          ? 'bg-black'
                          : 'bg-gray-300'
                      }`}
                    >
                      {status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : status === 'active' ? (
                        <Icon className="w-5 h-5 text-white" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-0.5">
                      <h3
                        className={`status-title mb-1 ${
                          status === 'pending' ? 'text-gray-400' : 'text-black'
                        }`}
                      >
                        {step.label}
                      </h3>
                      <p
                        className={`text-sm leading-relaxed ${
                          status === 'pending' ? 'text-gray-400' : 'text-gray-600'
                        }`}
                      >
                        {step.description}
                      </p>
                      {status === 'active' && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
                          <span className="text-sm font-semibold text-black">In Progress</span>
                        </div>
                      )}
                      {status === 'completed' && (
                        <div className="mt-3">
                          <span className="text-sm text-green-600 font-semibold">Completed</span>
                        </div>
                      )}
                    </div>

                    {/* Time Estimate */}
                    <div className="text-right">
                      {status === 'active' && (
                        <span className="text-xs sm:text-sm text-gray-600">~5 mins</span>
                      )}
                    </div>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute left-6 top-11 w-0.5 h-6 -ml-px ${
                        status === 'completed' ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-5 transition-all duration-200 hover:shadow-md">
          <h2 className="order-items mb-3">Order Items</h2>
          <div className="space-y-2.5">
            {order.items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2.5 border-b border-gray-200 last:border-0"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                </div>
                <p className="font-semibold">₹{item.price * item.quantity}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-5">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Need Help?</span> Contact our support team or call the
            restaurant at +91-XXXXX-XXXXX
          </p>
        </div>
      </div>
    </div>
  );
}