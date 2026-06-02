import { useState, useEffect, useRef } from 'react';
import { LoadingOrders } from '@/admin/components/ui/loading-spinner';
import { Button } from '@/admin/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/admin/components/ui/card';
import { Badge } from '@/admin/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/admin/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/admin/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/admin/components/ui/dropdown-menu';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Textarea } from '@/admin/components/ui/textarea';
import { Clock, Package, CheckCircle, XCircle, Plus, CreditCard, Eye, IndianRupee, UtensilsCrossed, Zap, Minus, Search, Repeat, Flame, AlertCircle, TrendingUp, Activity, ChefHat, Coffee, Timer, Undo2, Gauge, MoveRight, MoveLeft, Ban, Sparkles, Pizza, ShoppingBag, ClipboardList, ArrowUpDown, ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ordersApi, menuApi, staffApi } from '@/admin/utils/api';
import { useAuth } from '@/admin/utils/auth-context';
import { PaymentDialog } from '@/admin/components/payment-dialog';
import { QuickOrderPOS } from '@/admin/components/quick-order-pos';

interface Order {
  id: string;
  orderNumber?: string;
  tableNumber?: number;
  customerName?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'placed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
  type: 'dine-in' | 'takeaway' | 'delivery';
  createdAt: string;
  paymentMethod?: 'cash' | 'upi' | 'card';
  tags?: string[];
  statusUpdatedAt?: string;
  notes?: string;
  waiterId?: string;
  waiterName?: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
  cookingStation?: string;
}

interface TakeOrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  cookingStation?: string;
}

// ============ Take Order Sheet Component ============
function TakeOrderSheet({
  open,
  onOpenChange,
  order,
  menuItems,
  onOrderUpdated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: Order | null;
  menuItems: MenuItem[];
  onOrderUpdated: () => void;
}) {
  const [selectedItems, setSelectedItems] = useState<TakeOrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      // Pre-fill with existing items if any
      if (order && order.items.length > 0) {
        setSelectedItems(
          order.items.map((item, idx) => ({
            menuItemId: `existing-${idx}`,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          }))
        );
      } else {
        setSelectedItems([]);
      }
      setNotes(order?.notes || '');
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [open, order]);

  const categories = ['all', ...Array.from(new Set(menuItems.map((m) => m.category)))];

  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.available) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const addItem = (menuItem: MenuItem) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: 1, category: menuItem.category, cookingStation: menuItem.cookingStation }];
    });
  };

  const removeItem = (menuItemId: string) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItemId);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.menuItemId !== menuItemId);
    });
  };

  const total = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async () => {
    if (!order || selectedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    setSubmitting(true);
    try {
      await ordersApi.update(order.id, {
        items: selectedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          menuItemId: item.menuItemId,
          category: item.category || undefined,
          cookingStation: item.cookingStation || undefined,
        })),
        total,
        notes: notes || undefined,
        status: 'placed',
      });
      toast.success('Order updated with items!');
      onOrderUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col h-full overflow-hidden">
        <SheetHeader className="p-6 pb-4 border-b flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Take Order — {order.orderNumber || `Table ${order.tableNumber}`}
          </SheetTitle>
          <SheetDescription>
            {order.waiterName && `Waiter: ${order.waiterName} · `}
            {order.type === 'dine-in' && order.tableNumber ? `Table ${order.tableNumber}` : order.type}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Search + Category Filters */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat)}
                  className="capitalize text-xs"
                >
                  {cat === 'all' ? 'All' : cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="grid grid-cols-2 gap-3">
              {filteredMenuItems.map((item) => {
                const selected = selectedItems.find((i) => i.menuItemId === item.id);
                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => addItem(item)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                      </div>
                      <p className="text-sm font-semibold flex items-center gap-0.5 ml-2 shrink-0">
                        <IndianRupee className="h-3 w-3" />
                        {item.price}
                      </p>
                    </div>
                    {selected && (
                      <div className="mt-2 flex items-center justify-between">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(item.id);
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold">{selected.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            addItem(item);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredMenuItems.length === 0 && (
                <div className="col-span-2 py-8 text-center text-muted-foreground">
                  No menu items found
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {selectedItems.length > 0 && (
            <div className="p-4 border-t flex-shrink-0">
              <Label className="text-xs font-medium text-muted-foreground">Special Instructions</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., No onion, extra spicy..."
                className="mt-1 h-16 resize-none text-sm"
              />
            </div>
          )}
        </div>

        {/* Footer — Cart Summary + Submit */}
        <SheetFooter className="p-4 border-t bg-gray-50 flex-shrink-0">
          <div className="w-full space-y-3">
            {/* Cart Summary */}
            {selectedItems.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedItems.map((item) => (
                  <div key={item.menuItemId} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="font-medium flex items-center gap-0.5">
                      <IndianRupee className="h-3 w-3" />
                      {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t">
              <div>
                <p className="text-sm text-muted-foreground">{totalQty} item{totalQty !== 1 ? 's' : ''}</p>
                <p className="text-lg font-bold flex items-center gap-0.5">
                  <IndianRupee className="h-4 w-4" /> {total.toFixed(2)}
                </p>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={selectedItems.length === 0 || submitting}
                className="gap-2"
                size="lg"
              >
                {submitting ? (
                  <>Saving...</>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirm Order ({totalQty})
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}



// Innovation #6: Smart Notes Keywords
const SMART_NOTE_KEYWORDS = {
  'no onion': { color: 'text-orange-600', bg: 'bg-orange-50' },
  'no garlic': { color: 'text-orange-600', bg: 'bg-orange-50' },
  'extra spicy': { color: 'text-red-600', bg: 'bg-red-50' },
  'mild': { color: 'text-green-600', bg: 'bg-green-50' },
  'urgent': { color: 'text-yellow-600', bg: 'bg-yellow-50' },
  'allergy': { color: 'text-red-600', bg: 'bg-red-50' },
  'vip': { color: 'text-purple-600', bg: 'bg-purple-50' },
};

export function OrderManagement() {
  const { user } = useAuth();
  const isWaiter = user?.role === 'waiter';
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTable, setFilterTable] = useState<string>('all');
  const [filterWaiter, setFilterWaiter] = useState<string>('all');
  const [waiters, setWaiters] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  // Quick Order Panel State
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickOrderInitialTable, setQuickOrderInitialTable] = useState('');
  const [quickOrderExistingOrderId, setQuickOrderExistingOrderId] = useState<string | undefined>(undefined);

  // Innovation #9: Undo Last Action State
  const [lastAction, setLastAction] = useState<{
    orderId: string;
    previousStatus: Order['status'];
    newStatus: Order['status'];
    timestamp: number;
  } | null>(null);
  const [undoCountdown, setUndoCountdown] = useState<number>(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track deleted order IDs so polling never re-adds them
  const deletedIdsRef = useRef<Set<string>>(new Set());

  const normalizeOrder = (rawOrder: any): Order => {
    const rawItems = Array.isArray(rawOrder?.items) ? rawOrder.items : [];
    
    // Safely parse numeric values, using ?? to handle 0 correctly
    const safeNumber = (val: any, fallback: number = 0): number => {
      const num = Number(val);
      return isNaN(num) ? fallback : num;
    };
    
    // Normalize items with proper fallbacks
    const normalizedItems = rawItems.map((item: any) => ({
      name: item?.name || item?.dishName || item?.itemName || item?.Name || 'Unknown Item',
      quantity: Math.max(1, safeNumber(item?.quantity ?? item?.qty ?? item?.Qty, 1)),
      price: safeNumber(item?.price ?? item?.unitPrice ?? item?.Price, 0),
    }));
    
    // Calculate total from items if raw total is invalid
    const rawTotal = safeNumber(rawOrder?.total ?? rawOrder?.totalAmount ?? rawOrder?.grandTotal);
    const calculatedTotal = normalizedItems.reduce((sum: number, item: { name: string; quantity: number; price: number }) => sum + (item.price * item.quantity), 0);
    const finalTotal = rawTotal > 0 ? rawTotal : calculatedTotal;
    
    return {
      ...rawOrder,
      // Prefer the custom ORD-... id; fall back to MongoDB _id only if absent
      id: rawOrder?.id || rawOrder?._id || '',
      orderNumber: rawOrder?.orderNumber || rawOrder?.order_number,
      items: normalizedItems,
      total: finalTotal,
      createdAt: rawOrder?.createdAt || rawOrder?.created_at || new Date().toISOString(),
    };
  };

  useEffect(() => {
    fetchOrders();
    fetchMenuItems();
    fetchWaiters();
    const interval = setInterval(fetchOrders, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isWaiter]);

  const fetchWaiters = async () => {
    try {
      const res = await staffApi.list({ role: 'Waiter' });
      const data = Array.isArray(res) ? res : (res as any).data || [];
      setWaiters(data.map((s: any) => ({ id: s._id || s.id, name: s.name })));
    } catch (e) {
      console.error('Failed to fetch waiters', e);
    }
  };

  // Innovation #9: Undo countdown effect
  useEffect(() => {
    if (lastAction && undoCountdown > 0) {
      undoTimerRef.current = setTimeout(() => {
        setUndoCountdown(prev => prev - 1);
      }, 1000);
    } else if (undoCountdown === 0 && lastAction) {
      setLastAction(null);
    }

    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, [undoCountdown, lastAction]);

  const fetchOrders = async () => {
    try {
      // Always fetch all recent orders without a waiter_id filter.
      // The client-side filteredOrders already correctly shows each role
      // only what they should see — previously passing waiterId caused
      // client (customer) orders to be excluded when the $or backend
      // query filled the result limit with unrelated admin orders.
      const result = await ordersApi.list();
      const rawOrders = (result as any)?.data || result || [];
      setOrders(
        Array.isArray(rawOrders)
          ? rawOrders.map(normalizeOrder).filter((o: Order) => !deletedIdsRef.current.has(o.id))
          : []
      );
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch orders. Please check your connection.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const data = await menuApi.list();
      const items = (data as any)?.data || data || [];
      setMenuItems(Array.isArray(items) ? items.filter((item: MenuItem) => item.available !== false) : []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    }
  };

  const deleteOrder = async (orderId: string, orderDisplayId: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete order ${orderDisplayId}?\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    // Track as deleted so polling doesn't bring it back
    deletedIdsRef.current.add(orderId);
    // Optimistically remove the card immediately
    setOrders(prev => prev.filter(o => o.id !== orderId));
    try {
      const cleanId = orderId.replace('order:', '');
      await ordersApi.delete(cleanId);
      toast.success('Order deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting order:', error);
      // Revert optimistic removal on failure
      deletedIdsRef.current.delete(orderId);
      fetchOrders();
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        toast.error('Order not found. It may have already been deleted.');
      } else {
        toast.error('Failed to delete order');
      }
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status'], skipUndo: boolean = false) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      // Store for undo (Innovation #9)
      if (!skipUndo && order.status !== newStatus) {
        setLastAction({
          orderId,
          previousStatus: order.status,
          newStatus,
          timestamp: Date.now()
        });
        setUndoCountdown(10); // 10 second countdown
      }

      const cleanId = orderId.replace('order:', '');
      await ordersApi.updateStatus(cleanId, newStatus);
      const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
      toast.success(`Order marked as ${statusText}!`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  // Innovation #9: Undo function
  const undoLastAction = async () => {
    if (!lastAction) return;

    try {
      await updateOrderStatus(lastAction.orderId, lastAction.previousStatus, true);
      setLastAction(null);
      setUndoCountdown(0);
      toast.success('Action undone successfully!');
    } catch (error) {
      console.error('Error undoing action:', error);
      toast.error('Failed to undo action');
    }
  };

  const duplicateOrder = (order: Order) => {
    // TODO: Implement duplicate order in QuickOrderPOS
    toast.info('Duplicate order feature coming soon!');
    setQuickOrderOpen(true);
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return <Clock className="h-4 w-4" />;
      case 'preparing':
        return <Package className="h-4 w-4" />;
      case 'ready':
      case 'served':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return 'bg-blue-100 text-blue-700';
      case 'preparing':
        return 'bg-orange-100 text-orange-700';
      case 'ready':
        return 'bg-purple-100 text-purple-700';
      case 'served':
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
    }
  };

  const getOrderTypeBadge = (type: Order['type']) => {
    return type === 'dine-in' ? 'Dine-In' : type === 'takeaway' ? 'Takeaway' : 'Delivery';
  };

  const generateOrderDisplayId = (orderId: string | undefined, orderNumber?: string) => {
    // Prefer orderNumber from backend if available
    if (orderNumber) return orderNumber;
    if (!orderId) return '#UNKNOWN';
    const parts = orderId.split('-');
    const hash = parts[parts.length - 1] || orderId;
    return '#' + hash.slice(0, 6).toUpperCase();
  };

  // Innovation #4: Calculate order aging
  const getOrderAge = (order: Order) => {
    const statusTime = order.statusUpdatedAt || order.createdAt;
    const ageInMinutes = Math.floor((Date.now() - new Date(statusTime).getTime()) / 60000);
    return ageInMinutes;
  };

  // Innovation #4 & #5: Get delay level for visual highlighting and bottleneck detection
  const getDelayLevel = (ageInMinutes: number, status: Order['status']) => {
    if (status === 'served' || status === 'completed' || status === 'cancelled') return null;
    
    // Innovation #5: Kitchen bottleneck - orders stuck in preparing
    if (status === 'preparing' && ageInMinutes > 20) return 'bottleneck';
    if (ageInMinutes > 30) return 'critical';
    if (ageInMinutes > 15) return 'warning';
    return null;
  };

  // Innovation #3: Auto-assign priority based on tags and waiting time
  const getOrderPriority = (order: Order) => {
    const ageInMinutes = getOrderAge(order);
    const hasPriorityTag = order.tags?.includes('Priority');
    const isVIP = order.notes?.toLowerCase().includes('vip');
    const isUrgent = order.notes?.toLowerCase().includes('urgent');

    if (hasPriorityTag || isVIP || isUrgent || ageInMinutes > 30) {
      return { level: 'high', badge: 'Urgent', color: 'bg-red-500 text-white' };
    } else if (ageInMinutes > 15) {
      return { level: 'medium', badge: 'Normal', color: 'bg-yellow-500 text-white' };
    }
    return { level: 'low', badge: 'Low', color: 'bg-green-500 text-white' };
  };

  // Innovation #6: Parse and highlight smart notes
  const parseSmartNotes = (notes?: string) => {
    if (!notes) return null;

    const highlights: Array<{ text: string; keyword: string }> = [];
    const lowerNotes = notes.toLowerCase();

    Object.keys(SMART_NOTE_KEYWORDS).forEach(keyword => {
      if (lowerNotes.includes(keyword)) {
        highlights.push({ text: keyword, keyword });
      }
    });

    return highlights;
  };

  // Filter and search orders
  const filteredOrders = orders.filter(order => {
    // Waiters see their own orders AND unassigned client-placed orders (no waiterId)
    if (isWaiter && order.waiterId && order.waiterId !== user?.id) return false;
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    if (filterType !== 'all' && order.type !== filterType) return false;
    if (filterTable !== 'all' && order.tableNumber?.toString() !== filterTable) return false;
    if (!isWaiter && filterWaiter !== 'all' && order.waiterId !== filterWaiter) return false;
    if (searchQuery && !generateOrderDisplayId(order.id, order.orderNumber).toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Sort orders: new orders first, then bottleneck/delayed orders, then by creation time
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aAge = getOrderAge(a);
    const bAge = getOrderAge(b);
    const aDelay = getDelayLevel(aAge, a.status);
    const bDelay = getDelayLevel(bAge, b.status);

    // Separate active orders from processed/completed ones
    const aProcessed = ['served', 'completed', 'cancelled'].includes(a.status);
    const bProcessed = ['served', 'completed', 'cancelled'].includes(b.status);

    // Active orders always come before processed orders
    if (!aProcessed && bProcessed) return -1;
    if (aProcessed && !bProcessed) return 1;

    // Among active orders: bottleneck orders to top
    if (!aProcessed && !bProcessed) {
      if (aDelay === 'bottleneck' && bDelay !== 'bottleneck') return -1;
      if (bDelay === 'bottleneck' && aDelay !== 'bottleneck') return 1;
      
      // Then critical delays
      if (aDelay === 'critical' && bDelay !== 'critical') return -1;
      if (bDelay === 'critical' && aDelay !== 'critical') return 1;
      
      // Then warnings
      if (aDelay === 'warning' && bDelay !== 'warning') return -1;
      if (bDelay === 'warning' && aDelay !== 'warning') return 1;
    }

    // For orders at same priority level, sort by creation time (newest first)
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime; // Newest first
  });

  // Calculate statistics
  const activeOrders = orders.filter(o => !['served', 'completed', 'cancelled'].includes(o.status)).length;
  const servedToday = orders.filter(o => {
    const orderDate = new Date(o.createdAt);
    const today = new Date();
    return o.status === 'served' && 
           orderDate.getDate() === today.getDate() &&
           orderDate.getMonth() === today.getMonth() &&
           orderDate.getFullYear() === today.getFullYear();
  }).length;
  
  const preparingOrders = orders.filter(o => o.status === 'preparing' || o.status === 'ready');
  const avgPrepTime = preparingOrders.length > 0
    ? Math.floor(preparingOrders.reduce((sum, o) => sum + getOrderAge(o), 0) / preparingOrders.length)
    : 0;

  // Innovation #8: Kitchen Load Meter calculation
  const getKitchenLoad = () => {
    const activeCount = activeOrders;
    if (activeCount === 0) return { level: 'low', label: 'Low', color: 'text-green-600', bgColor: 'bg-green-100', percentage: 0 };
    if (activeCount <= 5) return { level: 'low', label: 'Low', color: 'text-green-600', bgColor: 'bg-green-100', percentage: 33 };
    if (activeCount <= 10) return { level: 'medium', label: 'Medium', color: 'text-orange-600', bgColor: 'bg-orange-100', percentage: 66 };
    return { level: 'high', label: 'High', color: 'text-red-600', bgColor: 'bg-red-100', percentage: 100 };
  };

  const kitchenLoad = getKitchenLoad();
  const kitchenLoadClass = `ds-w-pct-${Math.max(0, Math.min(100, Math.round(kitchenLoad.percentage)))}`;

  // Get unique table numbers for filter
  const tableNumbers = Array.from(new Set(orders.map(o => o.tableNumber).filter(Boolean)));

  if (loading) {
    return <LoadingOrders />;
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] p-4 sm:p-5 space-y-4 text-[#2c2c2c]">
      {/* Header Section */}
      <div className="flex items-center justify-end">
        {/* Quick Order Button */}
        <Button onClick={() => setQuickOrderOpen(true)} size="sm" className="h-9 rounded-md gap-2 shadow-sm">
          <Zap className="h-4 w-4" />
          Quick Order
        </Button>
      </div>

      {/* Mini Order Insights */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Card className="rounded-xl border border-[#ece5dc] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[14px] font-medium text-muted-foreground">Active Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex h-[50px] items-center justify-between">
              <Activity className="h-4 w-4 text-orange-600" />
              <span className="text-[20px] leading-none font-bold">{activeOrders}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-[#ece5dc] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[14px] font-medium text-muted-foreground">Avg Prep Time</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex h-[50px] items-center justify-between">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="text-[20px] leading-none font-bold">{avgPrepTime} min</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-[#ece5dc] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[14px] font-medium text-muted-foreground">Served Today</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex h-[50px] items-center justify-between">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-[20px] leading-none font-bold">{servedToday}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Innovation #8: Kitchen Load Meter */}
      <Card className="rounded-xl border border-[#ece5dc] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gauge className={`h-5 w-5 ${kitchenLoad.color}`} />
              <div>
                <p className="text-[14px] font-medium text-muted-foreground">Kitchen Load</p>
                <p className={`text-base font-semibold ${kitchenLoad.color}`}>
                  {kitchenLoad.label} ({activeOrders} active orders)
                </p>
              </div>
            </div>
            <div className="w-40 h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  kitchenLoad.level === 'high' ? 'bg-red-500' :
                  kitchenLoad.level === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                } ${kitchenLoadClass}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Smart Filters & Search */}
      <Card className="rounded-[10px] border border-[#ece5dc] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 rounded-md"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-[160px] rounded-md">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="served">Served</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-[160px] rounded-md">
                <SelectValue placeholder="Order Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="dine-in">Dine-In</SelectItem>
                <SelectItem value="takeaway">Takeaway</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterTable} onValueChange={setFilterTable}>
              <SelectTrigger className="h-9 w-[140px] rounded-md">
                <SelectValue placeholder="Table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {tableNumbers.map(table => (
                  <SelectItem key={table} value={table!.toString()}>
                    Table {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Only admins/managers can filter by waiter */}
            {!isWaiter && (
              <Select value={filterWaiter} onValueChange={setFilterWaiter}>
                <SelectTrigger className="h-9 w-[170px] rounded-md">
                  <SelectValue placeholder="Waiter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Waiters</SelectItem>
                  {waiters.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button 
              variant="outline" 
              className="h-9 rounded-md"
              onClick={() => {
                setFilterStatus('all');
                setFilterType('all');
                setFilterTable('all');
                setFilterWaiter('all');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 rounded-md gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => setSortBy('newest')}
                  className={sortBy === 'newest' ? 'bg-accent' : ''}
                >
                  <ArrowDown className="h-4 w-4 mr-2" />
                  New to Old
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSortBy('oldest')}
                  className={sortBy === 'oldest' ? 'bg-accent' : ''}
                >
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Old to New
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Innovation #9: Undo Last Action Toast */}
      {lastAction && undoCountdown > 0 && (
        <Card className="rounded-xl border border-[#f1d2a6] bg-[#fff8e8] shadow-[0_2px_6px_rgba(0,0,0,0.04)]">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-yellow-700" />
                <div>
                  <p className="text-xs sm:text-sm font-medium">
                    Order status changed to <strong>{lastAction.newStatus}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Undo in {undoCountdown} second{undoCountdown !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={undoLastAction}
                className="h-8 rounded-md gap-1.5 border-yellow-700 text-yellow-800 hover:bg-yellow-100"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Grid */}
      {sortedOrders.length === 0 ? (
        <Card className="rounded-xl border border-[#ece5dc] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No orders found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {sortedOrders.map((order) => {
            const orderItems = Array.isArray(order.items) ? order.items : [];
            const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
            const ageInMinutes = getOrderAge(order);
            const delayLevel = getDelayLevel(ageInMinutes, order.status);
            const priority = getOrderPriority(order);
            const smartNotes = parseSmartNotes(order.notes);
            
            return (
              <Card 
                key={order.id} 
                className={`rounded-xl border bg-white shadow-[0_4px_10px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] transition-all duration-200 ${
                  delayLevel === 'bottleneck' ? 'border-red-300' :
                  delayLevel === 'critical' ? 'border-red-200' :
                  delayLevel === 'warning' ? 'border-amber-200' : 'border-[#ece5dc]'
                }`}
              >
                <CardHeader className="p-4 pb-2 relative">
                  {/* Delete Button - Top Right Corner */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteOrder(order.id, generateOrderDisplayId(order.id, order.orderNumber))}
                    className="absolute top-2 right-2 h-7 w-7 rounded-md p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  
                  <div className="flex justify-between items-start mb-2 pr-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-base font-semibold leading-tight">
                          {generateOrderDisplayId(order.id, order.orderNumber)}
                        </CardTitle>
                        {/* Innovation #3: Priority Badge */}
                        {!['served', 'completed', 'cancelled'].includes(order.status) && (
                          <Badge className={`text-xs ${priority.color}`}>
                            {priority.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {getOrderTypeBadge(order.type)}
                        </Badge>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                        {order.tags?.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Innovation #5: Bottleneck Alert */}
                  {delayLevel === 'bottleneck' && (
                    <div className="mt-2 p-1.5 bg-[#fdecea] border border-[#f6c7c2] rounded-md">
                      <div className="flex items-center gap-1.5 text-[#b54444]">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-medium">Kitchen Bottleneck - Priority attention needed</p>
                      </div>
                    </div>
                  )}

                  {/* Innovation #6: Smart Notes Highlighter */}
                  {smartNotes && smartNotes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {smartNotes.map((note, idx) => {
                        const keyword = SMART_NOTE_KEYWORDS[note.keyword as keyof typeof SMART_NOTE_KEYWORDS];
                        return (
                          <Badge 
                            key={idx} 
                            className={`text-xs ${keyword.bg} ${keyword.color} border-0`}
                          >
                            {note.text}
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Smart Order Status Timeline */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between text-[11px] leading-none">
                      <div className={`flex flex-col items-center gap-1 ${order.status === 'placed' ? 'text-foreground font-medium' : order.status === 'cancelled' ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                        <Clock className="h-3 w-3" />
                        <span>Placed</span>
                      </div>
                      <div className="flex-1 h-0.5 mx-1 bg-muted" />
                      <div className={`flex flex-col items-center gap-1 ${order.status === 'preparing' ? 'text-foreground font-medium' : ['ready', 'served', 'completed'].includes(order.status) ? 'text-muted-foreground/50' : 'text-muted-foreground/30'}`}>
                        <Package className="h-3 w-3" />
                        <span>Preparing</span>
                      </div>
                      <div className="flex-1 h-0.5 mx-1 bg-muted" />
                      <div className={`flex flex-col items-center gap-1 ${order.status === 'ready' ? 'text-foreground font-medium' : ['served', 'completed'].includes(order.status) ? 'text-muted-foreground/50' : 'text-muted-foreground/30'}`}>
                        <AlertCircle className="h-3 w-3" />
                        <span>Ready</span>
                      </div>
                      <div className="flex-1 h-0.5 mx-1 bg-muted" />
                      <div className={`flex flex-col items-center gap-1 ${['served', 'completed'].includes(order.status) ? 'text-foreground font-medium' : 'text-muted-foreground/30'}`}>
                        <CheckCircle className="h-3 w-3" />
                        <span>Served</span>
                      </div>
                    </div>
                  </div>

                  {/* Innovation #4: Order Aging Indicator */}
                  {!['served', 'completed', 'cancelled'].includes(order.status) && (
                    <div className={`mt-2 p-2 rounded-md text-xs font-medium flex items-center gap-2 ${
                      delayLevel === 'critical' ? 'bg-red-100 text-red-700' :
                      delayLevel === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      delayLevel === 'bottleneck' ? 'bg-red-200 text-red-800' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      <Timer className={`h-4 w-4 ${delayLevel ? 'animate-pulse' : ''}`} />
                      <span>⏱ Waiting {ageInMinutes} min{ageInMinutes !== 1 ? 's' : ''}</span>
                      {delayLevel && (
                        <AlertCircle className="h-4 w-4 ml-auto animate-pulse" />
                      )}
                    </div>
                  )}
                  
                  {/* Customer & Table Info */}
                  <div className="text-sm text-muted-foreground space-y-1 mt-2">
                    {order.type === 'dine-in' && order.tableNumber && (
                      <div className="flex items-center gap-1">
                        <UtensilsCrossed className="h-3.5 w-3.5" />
                        <span>Table {order.tableNumber}</span>
                      </div>
                    )}                    {order.waiterName && (
                      <div className="flex items-center gap-1">
                        <ChefHat className="h-3.5 w-3.5" />
                        <span>Waiter: {order.waiterName}</span>
                      </div>
                    )}                    {order.customerName && (
                      <div className="font-medium text-foreground">
                        {order.customerName}
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 pt-0 space-y-3">
                  {/* Order Items */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      ORDER ITEMS ({totalItems} {totalItems === 1 ? 'item' : 'items'})
                    </p>
                    <ul className="text-sm space-y-1.5">
                      {orderItems.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="flex items-center gap-0.5 font-medium">
                            <IndianRupee className="h-3 w-3" />
                            {(item.price * item.quantity).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Order Summary */}
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">Total Amount</span>
                      <span className="text-lg font-bold flex items-center gap-0.5">
                        <IndianRupee className="h-4 w-4" />
                        {order.total.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'Asia/Kolkata'
                        })} IST
                      </span>
                      {order.paymentMethod && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {order.paymentMethod.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Context-Aware Action Buttons */}
                  <div className="flex flex-col gap-2 pt-2">
                    {/* Take Order — opens Quick Order POS with table pre-filled (waiters only) */}
                    {!isAdminOrManager && order.status === 'placed' && (!order.items || order.items.length === 0 || order.items.every(i => !i.name || i.name === 'Unknown Item')) && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setQuickOrderInitialTable(order.tableNumber ? String(order.tableNumber) : '');
                          setQuickOrderExistingOrderId(order.id);
                          setQuickOrderOpen(true);
                        }}
                        className="w-full h-8 rounded-md text-xs gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <ClipboardList className="h-4 w-4" />
                        Take Order
                      </Button>
                    )}

                    {/* Primary Action — Accept (only when items exist; not for waiters) */}
                    {!isWaiter && order.status === 'placed' && order.items && order.items.length > 0 && !order.items.every(i => !i.name || i.name === 'Unknown Item') && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="w-full h-8 rounded-md text-xs gap-2"
                      >
                        <MoveRight className="h-4 w-4" />
                        Accept Order
                      </Button>
                    )}
                    {order.status === 'preparing' && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="w-full h-8 rounded-md text-xs gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark as Ready
                      </Button>
                    )}
                    {order.status === 'ready' && (
                      <Button
                        size="sm"
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="w-full h-8 rounded-md text-xs gap-2"
                      >
                        <UtensilsCrossed className="h-4 w-4" />
                        Mark as Served
                      </Button>
                    )}
                    
                    {/* Secondary Actions */}
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 rounded-md text-xs"
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Order Details {generateOrderDisplayId(order.id, order.orderNumber)}</DialogTitle>
                            <DialogDescription>
                              Complete order information
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div>
                              <p className="text-sm font-medium mb-1">Order Type</p>
                              <p className="text-sm text-muted-foreground">{getOrderTypeBadge(order.type)}</p>
                            </div>
                            {order.tableNumber && (
                              <div>
                                <p className="text-sm font-medium mb-1">Table Number</p>
                                <p className="text-sm text-muted-foreground">Table {order.tableNumber}</p>
                              </div>
                            )}
                            {order.customerName && (
                              <div>
                                <p className="text-sm font-medium mb-1">Customer Name</p>
                                <p className="text-sm text-muted-foreground">{order.customerName}</p>
                              </div>
                            )}
                            {order.notes && (
                              <div>
                                <p className="text-sm font-medium mb-1">Notes</p>
                                <p className="text-sm text-muted-foreground">{order.notes}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium mb-1">Status</p>
                              <Badge className={getStatusColor(order.status)}>
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium mb-2">Items</p>
                              <ul className="space-y-2">
                                {(Array.isArray(order.items) ? order.items : []).map((item, idx) => (
                                  <li key={idx} className="flex justify-between text-sm">
                                    <span>{item.quantity}x {item.name}</span>
                                    <span className="flex items-center gap-0.5">
                                      <IndianRupee className="h-3 w-3" />
                                      {(item.price * item.quantity).toFixed(2)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="pt-3 border-t">
                              <div className="flex justify-between font-semibold">
                                <span>Total</span>
                                <span className="flex items-center gap-0.5">
                                  <IndianRupee className="h-4 w-4" />
                                  {order.total.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {/* Duplicate Order Feature */}
                      {['served', 'completed'].includes(order.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-md"
                          onClick={() => duplicateOrder(order)}
                        >
                          <Repeat className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      
                      {order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'served' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-md border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => updateOrderStatus(order.id, 'cancelled')}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}</div>
      )}

      {/* Quick Order POS — also used for Take Order with pre-filled table */}
      <QuickOrderPOS
        open={quickOrderOpen}
        onOpenChange={(o) => { setQuickOrderOpen(o); if (!o) { setQuickOrderInitialTable(''); setQuickOrderExistingOrderId(undefined); } }}
        onOrderCreated={fetchOrders}
        initialTableNumber={quickOrderInitialTable}
        existingOrderId={quickOrderExistingOrderId}
        initialOrderType="dine-in"
      />

      {selectedOrder && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          orderId={selectedOrder.id}
          amount={selectedOrder.total}
          onSuccess={fetchOrders}
        />
      )}
    </div>
  );
}
