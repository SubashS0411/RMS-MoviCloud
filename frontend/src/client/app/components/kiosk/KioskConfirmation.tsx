import { useEffect, useState } from 'react';
import { CheckCircle, Clock, ChefHat, Package, Copy, Check, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order } from '@/client/app/App';
import { apiRequest } from '@/client/api/client';
import { fetchSystemConfig } from '@/client/api/config';
import TopAppBar from '@/client/app/components/TopAppBar';

interface KioskConfirmationProps {
  order: Order;
  onNewOrder: () => void;
  onGoHome: () => void;
}

export default function KioskConfirmation({ order, onNewOrder, onGoHome }: KioskConfirmationProps) {
  const [currentStatus, setCurrentStatus] = useState<Order['status']>(order.status || 'preparing');
  const [copied, setCopied] = useState(false);
  const [sysConfig, setSysConfig] = useState({ restaurantName: 'Restaurant', logoUrl: '/favicon.png' });

  useEffect(() => {
    fetchSystemConfig().then((cfg) => {
      setSysConfig({ restaurantName: cfg.restaurantName || 'Restaurant', logoUrl: cfg.logoUrl || '/favicon.png' });
    }).catch(() => {});
  }, []);

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

    poll();
    const interval = setInterval(() => {
      if (TERMINAL_STATUSES.includes(currentStatus)) {
        clearInterval(interval);
        return;
      }
      poll();
    }, 5000);

    return () => clearInterval(interval);
  }, [order?.id, currentStatus]);

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const loadImageAsBase64 = (url: string): Promise<string | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const handleDownloadReceipt = async () => {
    const dateStr = new Date(order.date).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    const w = doc.internal.pageSize.getWidth();
    const ml = 5; // margin left
    const mr = 5; // margin right
    const contentW = w - ml - mr;
    let y = 5;

    // Logo
    const imgData = await loadImageAsBase64(sysConfig.logoUrl);
    if (imgData) {
      const logoSize = 12;
      doc.addImage(imgData, 'PNG', w / 2 - logoSize / 2, y, logoSize, logoSize);
      y += 15;
    } else {
      y = 10;
    }

    // Header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(sysConfig.restaurantName, w / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text('Kiosk Order Receipt', w / 2, y, { align: 'center' });
    y += 5;

    // Dashed line
    doc.setDrawColor(180);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(ml, y, w - mr, y);
    y += 6;

    // Order ID
    doc.setTextColor(80);
    doc.setFontSize(8);
    doc.text('Order ID', w / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text(order.id, w / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(dateStr, w / 2, y, { align: 'center' });
    y += 5;

    // Dashed line
    doc.setDrawColor(180);
    doc.line(ml, y, w - mr, y);
    y += 3;

    // Items table
    const tableData = order.items.map((item) => [
      item.name,
      String(item.quantity),
      `Rs.${(item.price * item.quantity).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Qty', 'Amount']],
      body: tableData,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2, textColor: [40, 40, 40], overflow: 'linebreak' },
      headStyles: { fontStyle: 'bold', fontSize: 8, textColor: [20, 20, 20], lineWidth: { bottom: 0.3 }, lineColor: [100, 100, 100] },
      columnStyles: {
        0: { cellWidth: contentW * 0.50, halign: 'left' },
        1: { cellWidth: contentW * 0.15, halign: 'center' },
        2: { cellWidth: contentW * 0.35, halign: 'right' },
      },
      margin: { left: ml, right: mr },
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // Totals section
    doc.setDrawColor(180);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(ml, y, w - mr, y);
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    doc.text('Subtotal', ml + 1, y);
    doc.text(`Rs.${(order.subtotal ?? 0).toFixed(2)}`, w - mr - 1, y, { align: 'right' });
    y += 5;
    doc.text('GST (5%)', ml + 1, y);
    doc.text(`Rs.${(order.tax ?? 0).toFixed(2)}`, w - mr - 1, y, { align: 'right' });
    y += 4;

    // Total line
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(30);
    doc.setLineWidth(0.4);
    doc.line(ml, y, w - mr, y);
    y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20);
    doc.text('Total Paid', ml + 1, y);
    doc.text(`Rs.${order.total.toFixed(2)}`, w - mr - 1, y, { align: 'right' });
    y += 8;

    // Footer
    doc.setDrawColor(180);
    doc.setLineDashPattern([1, 1], 0);
    doc.setLineWidth(0.2);
    doc.line(ml, y, w - mr, y);
    y += 5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140);
    doc.text('Thank you for your order!', w / 2, y, { align: 'center' });
    y += 4;
    doc.text('Show your Order ID at the counter', w / 2, y, { align: 'center' });
    y += 3;
    doc.text('to collect your food.', w / 2, y, { align: 'center' });

    doc.save(`Receipt-${order.id}.pdf`);
  };

  const steps = [
    { key: 'preparing', label: 'Preparing', icon: ChefHat, description: 'Your food is being prepared in the kitchen' },
    { key: 'ready', label: 'Ready', icon: Package, description: 'Your order is ready for pickup at the counter' },
    { key: 'completed', label: 'Collected', icon: CheckCircle, description: 'Order collected. Enjoy your meal!' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStatus);
  const isReady = currentStatus === 'ready' || currentStatus === 'served';
  const isCompleted = currentStatus === 'completed';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F2]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 right-[-6rem] h-64 w-64 rounded-full bg-[#C8A47A]/20 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-[-4rem] h-72 w-72 rounded-full bg-[#8B5A2B]/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/70 to-transparent" />
      </div>

      <div className="relative z-10 px-3 sm:px-5 pt-3 sm:pt-5">
        <TopAppBar
          title="Order Confirmed"
          centerSlot={
            <div className="hidden md:flex items-center gap-2">
              <span className="rounded-full border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1 text-[11px] font-semibold text-[#6D4C41]">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''}
              </span>
              <span className="rounded-full border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1 text-[11px] font-semibold text-[#6D4C41]">
                Counter Pickup
              </span>
            </div>
          }
          rightSlot={
            <button
              onClick={onGoHome}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8DED0] bg-[#FCFAF7] px-3 py-1.5 text-[11px] font-semibold text-[#3E2723] transition-colors hover:border-[#C8A47A] hover:text-[#8B5A2B]"
            >
              Back to Home
            </button>
          }
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-5 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)] gap-4 lg:gap-5 items-start">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#E8D5B5] bg-gradient-to-br from-white via-[#FFF9F2] to-[#F8E8D4] p-5 sm:p-6 shadow-[0_18px_55px_rgba(62,39,35,0.08)]">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#8B5A2B] via-[#C8A47A] to-transparent" />
              <div className="flex flex-col gap-5 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
                <div className="flex flex-col items-center lg:items-start">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E8D5B5] bg-white shadow-sm">
                    {isReady || isCompleted ? (
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    ) : (
                      <ChefHat className="w-8 h-8 text-[#8B5A2B] animate-pulse" />
                    )}
                  </div>
                  <span className="mb-2 inline-flex rounded-full border border-[#E8D5B5] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8B5A2B]">
                    {isReady ? 'Ready for pickup' : isCompleted ? 'Collected' : 'In the kitchen'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-[#3E2723] tracking-tight">
                    {isReady ? 'Order Ready!' : isCompleted ? 'Order Completed' : 'Order Placed!'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6D4C41] sm:text-[15px]">
                    {isReady
                      ? 'Please collect your order at the counter'
                      : isCompleted
                      ? 'Thank you for dining with us!'
                      : 'Your order is being prepared'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:max-w-xl">
                  <div className="rounded-2xl border border-[#E8D5B5] bg-white/80 px-4 py-3 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8B5A2B]">Items</p>
                    <p className="mt-1 text-lg font-black text-[#3E2723]">{order.items.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[#E8D5B5] bg-white/80 px-4 py-3 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8B5A2B]">Pickup</p>
                    <p className="mt-1 text-lg font-black text-[#3E2723]">Counter</p>
                  </div>
                  <div className="rounded-2xl border border-[#E8D5B5] bg-white/80 px-4 py-3 text-center shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8B5A2B]">Placed</p>
                    <p className="mt-1 text-lg font-black text-[#3E2723]">{new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#E8D5B5] bg-white p-5 sm:p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base sm:text-lg font-bold text-[#3E2723]">Order Status</h3>
                <span className="rounded-full bg-[#FAF0E4] px-3 py-1 text-[11px] font-semibold text-[#8B5A2B]">Live tracking</span>
              </div>
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index <= currentStepIndex || (isReady && index <= 1);
                  const isCurrent = step.key === currentStatus || (isReady && step.key === 'ready');

                  return (
                    <div
                      key={step.key}
                      className={`rounded-2xl border p-3.5 transition-all ${
                        isCurrent
                          ? 'border-[#C8A47A] bg-[#FAF0E4]/70 shadow-sm'
                          : isActive
                          ? 'border-[#E8D5B5] bg-[#FFFCF8]'
                          : 'border-[#EFE6DA] bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-0.5">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                            isActive
                              ? isCurrent
                                ? 'bg-[#8B5A2B] ring-4 ring-[#C8A47A]/30'
                                : 'bg-green-500'
                              : 'bg-gray-200'
                          }`}>
                            <StepIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          {index < steps.length - 1 && (
                            <div className={`w-0.5 h-8 mt-1 ${isActive ? 'bg-green-300' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className={`text-sm font-semibold ${isActive ? 'text-[#3E2723]' : 'text-gray-400'}`}>
                            {step.label}
                            {isCurrent && !isCompleted && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-normal text-[#8B5A2B]">
                                <Clock className="w-3 h-3 animate-pulse" /> In progress
                              </span>
                            )}
                          </p>
                          <p className={`mt-0.5 text-xs leading-5 ${isActive ? 'text-gray-600' : 'text-gray-300'}`}>{step.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-4">
            <div className="rounded-[2rem] border border-[#C8A47A] bg-gradient-to-br from-white via-[#FFF9F2] to-[#F4E1C7] p-5 sm:p-6 text-center shadow-[0_18px_55px_rgba(139,90,43,0.12)]">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8B5A2B]">Your Order ID</p>
              <div className="flex items-center justify-center gap-2">
                <p className="font-mono text-2xl sm:text-3xl font-black tracking-[0.18em] text-[#3E2723]">{order.id}</p>
                <button
                  onClick={handleCopyOrderId}
                  className="rounded-lg p-1.5 text-[#8B5A2B] transition-colors hover:bg-[#FAF0E4]"
                  title="Copy Order ID"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#6D4C41]">Show this ID at the counter to collect your food</p>
            </div>

            <div className="rounded-[2rem] border border-[#E8D5B5] bg-white p-5 sm:p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base sm:text-lg font-bold text-[#3E2723]">Order Details</h3>
                <span className="rounded-full bg-[#FAF0E4] px-3 py-1 text-[11px] font-semibold text-[#8B5A2B]">Receipt board</span>
              </div>
              <div className="space-y-2.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-[#EFE6DA] bg-[#FFFCF8] px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                      </div>
                      <span className="text-[#3E2723] truncate">{item.name}</span>
                      <span className="text-gray-400 shrink-0">×{item.quantity}</span>
                    </div>
                    <span className="font-semibold text-[#8B5A2B] shrink-0">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1 rounded-2xl bg-[#FAF0E4]/60 p-3">
                <div className="flex justify-between text-xs text-[#6D4C41]">
                  <span>Subtotal</span>
                  <span>₹{(order.subtotal ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#6D4C41]">
                  <span>GST (5%)</span>
                  <span>₹{(order.tax ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E8D5B5] pt-2 font-bold text-[#3E2723]">
                  <span>Total Paid</span>
                  <span className="text-[#8B5A2B]">₹{order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#E8D5B5] bg-[#FAF0E4] p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-bold text-[#3E2723]">Pickup Info</h3>
              <p className="text-xs leading-5 text-[#6D4C41]">Your order is marked for counter pickup. Keep the order ID visible when you arrive so the staff can hand over your food quickly.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <button
                onClick={handleDownloadReceipt}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#3E2723] px-5 py-3.5 text-sm font-bold text-[#C8A47A] transition-all hover:bg-[#5D4037] active:scale-95"
              >
                <Download className="w-4 h-4" /> Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
